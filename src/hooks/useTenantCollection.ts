import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export function useTenantCollection<T>(collectionName: string, additionalConstraints: QueryConstraint[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { dbUser, activeCompanyId, isAdmin } = useAuth();

  useEffect(() => {
    const companyId = activeCompanyId || dbUser?.companyId;
    
    // If no companyId and not an admin (who might see everything in some contexts, though usually we want to restrict), return empty
    if (!companyId && !isAdmin) {
      setData([]);
      setLoading(false);
      return;
    }

    let q;
    if (companyId) {
      q = query(
        collection(db, collectionName),
        where('companyId', '==', companyId),
        ...additionalConstraints
      );
    } else {
      // Fallback for super admins if needed, though usually we want a company context
      q = query(collection(db, collectionName), ...additionalConstraints);
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionName);
      }
    );

    return () => unsubscribe();
  }, [collectionName, activeCompanyId, dbUser?.companyId, isAdmin, JSON.stringify(additionalConstraints)]);

  return { data, loading, error };
}
