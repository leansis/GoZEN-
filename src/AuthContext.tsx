import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, getDocFromServer, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Role, Company } from './types';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';

interface AuthContextType {
  user: FirebaseUser | null;
  dbUser: User | null;
  company: Company | null;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  loading: boolean;
  login: (useRedirect?: boolean) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isLeanPromotor: boolean;
  isGlobalAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(localStorage.getItem('activeCompanyId'));
  const [loading, setLoading] = useState(true);

  const setActiveCompanyId = (id: string | null) => {
    setActiveCompanyIdState(id);
    if (id) {
      localStorage.setItem('activeCompanyId', id);
    } else {
      localStorage.removeItem('activeCompanyId');
    }
  };

  useEffect(() => {
    if (activeCompanyId) {
      const unsubscribe = onSnapshot(doc(db, 'companies', activeCompanyId), 
        (doc) => {
          if (doc.exists()) {
            setCompany(doc.data() as Company);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `companies/${activeCompanyId}`);
        }
      );
      return () => unsubscribe();
    } else {
      setCompany(null);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email);
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const currentUserEmail = firebaseUser.email?.toLowerCase().trim();
          const isDefaultAdmin = currentUserEmail === "leansisproductivity@gmail.com" || 
                                (import.meta.env.VITE_DEFAULT_ADMIN_EMAIL && currentUserEmail === import.meta.env.VITE_DEFAULT_ADMIN_EMAIL.toLowerCase().trim());
          
          console.log("Admin check:", { currentUserEmail, isDefaultAdmin });
          
          // FORCE ADMIN ACCESS IN MEMORY IMMEDIATELY FOR OWNER
          if (isDefaultAdmin) {
            const adminProfile: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin Global',
              email: firebaseUser.email || "leansisproductivity@gmail.com",
              role: 'admin',
              status: 'active',
              photoURL: firebaseUser.photoURL || undefined,
            };
            setDbUser(adminProfile);
            console.log("Default admin profile forced in-memory");
          }

          let existingUser: User | null = null;
          const fetchUser = async () => {
            console.log("Fetching user...");
            // 1. Try to find user by UID (correct document ID)
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                existingUser = { id: userDoc.id, ...userDoc.data() } as User;
                console.log("User found by UID");
                return;
              }
            } catch (error) {
              console.warn("Error fetching user by UID:", error);
            }

            // 2. Not found by UID, try to find by email as document ID (legacy migration)
            const emailDocId = firebaseUser.email?.toLowerCase().trim();
            if (emailDocId) {
              try {
                const emailDoc = await getDoc(doc(db, 'users', emailDocId));
                if (emailDoc.exists()) {
                   const data = emailDoc.data() as User;
                   console.log("User found by email index, migrating...");
                   const migratedUser = { ...data, uid: firebaseUser.uid };
                   
                   // Try to migrate
                   await setDoc(doc(db, 'users', firebaseUser.uid), migratedUser);
                   // Try to delete old index (might fail if not owner of that specific string ID, but we have the data now)
                   try { await deleteDoc(doc(db, 'users', emailDocId)); } catch(e) { console.warn("Could not delete legacy email doc:", e); }
                   
                   existingUser = migratedUser;
                   return;
                }
              } catch (error) {
                console.warn("Error fetching user by email-ID:", error);
              }
            }
          };

          await fetchUser();

          if (existingUser) {
            console.log("Found existing user:", existingUser.email);
            let needsUpdate = false;
            if (isDefaultAdmin && existingUser.role !== 'admin') {
              existingUser.role = 'admin';
              needsUpdate = true;
            }
            if (needsUpdate) {
              try {
                await setDoc(doc(db, 'users', existingUser.uid), existingUser, { merge: true });
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${existingUser.uid}`);
              }
            }
            setDbUser(existingUser);
            
            if (existingUser.companyId && !activeCompanyId) {
              try {
                const companyDoc = await getDoc(doc(db, 'companies', existingUser.companyId));
                if (companyDoc.exists()) {
                  setCompany(companyDoc.data() as Company);
                  setActiveCompanyId(existingUser.companyId);
                }
              } catch (error) {
                handleFirestoreError(error, OperationType.GET, `companies/${existingUser.companyId}`);
              }
            }
          } else if (isDefaultAdmin) {
            console.log("Creating default admin profile...");
            // ONLY create a new user automatically if it's the default admin
            const newUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin Global',
              email: firebaseUser.email || "leansisproductivity@gmail.com",
              role: 'admin',
              status: 'active',
              photoURL: firebaseUser.photoURL || undefined,
            };
            
            // Set state immediately to allow UI to proceed
            setDbUser(newUser);

            try {
              console.log("Attempting to persist admin profile...");
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              console.log("User profile persisted successfully");
            } catch (error) {
              console.error("Error persisting admin profile (but proceeding in-memory):", error);
              // We don't throw here to avoid blocking the owner
            }
          } else {
            // User not pre-registered and not default admin
            setDbUser(null);
          }
        } catch (error) {
          console.error("Critical error in auth state change:", error);
        }
      } else {
        setDbUser(null);
        setCompany(null);
        setActiveCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (useRedirect = false) => {
    const provider = new GoogleAuthProvider();
    if (useRedirect) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdminCheck = dbUser?.role === 'admin' || dbUser?.role === 'lean_promotor' || (user?.email?.toLowerCase().trim() === "leansisproductivity@gmail.com") || (import.meta.env.VITE_DEFAULT_ADMIN_EMAIL && user?.email?.toLowerCase().trim() === import.meta.env.VITE_DEFAULT_ADMIN_EMAIL.toLowerCase().trim());
  const isGlobalAdminCheck = dbUser?.role === 'admin' || (user?.email?.toLowerCase().trim() === "leansisproductivity@gmail.com") || (import.meta.env.VITE_DEFAULT_ADMIN_EMAIL && user?.email?.toLowerCase().trim() === import.meta.env.VITE_DEFAULT_ADMIN_EMAIL.toLowerCase().trim());

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        company,
        activeCompanyId,
        setActiveCompanyId,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        isAdmin: isAdminCheck,
        isSupervisor: dbUser?.role === 'supervisor',
        isLeanPromotor: dbUser?.role === 'lean_promotor',
        isGlobalAdmin: isGlobalAdminCheck,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
