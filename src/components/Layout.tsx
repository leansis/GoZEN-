import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { 
  LayoutDashboard, 
  GraduationCap, 
  BarChart3, 
  Network, 
  Users, 
  UserCog, 
  Settings, 
  CheckSquare, 
  ListChecks,
  Tag,
  ClipboardList,
  MessagesSquare,
  AlertCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Folder,
  Building2,
  Database,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react';
import clsx from 'clsx';

export default function Layout() {
  const { dbUser, logout, company, isAdmin } = useAuth();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const polivalenciaPaths = ['/matrix', '/process-map', '/training', '/statistics'];
  const [isPolivalenciaOpen, setIsPolivalenciaOpen] = useState(
    polivalenciaPaths.includes(location.pathname)
  );

  const polivalenciaItems = [
    { name: 'Matriz', path: '/matrix', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Mapa de procesos', path: '/process-map', icon: Network, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Acciones formativas', path: '/training', icon: GraduationCap, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Estadísticas', path: '/statistics', icon: BarChart3, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
  ];

  const topLevelItems = [
    { name: 'OHP', path: '/ohp', icon: Network, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Incidencias', path: '/incidents', icon: AlertCircle, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Plan de acciones', path: '/action-plan', icon: ClipboardList, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Foros', path: '/forums', icon: MessagesSquare, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
  ];

  const adminItems = [
    { name: 'Foros', path: '/admin/forums', icon: MessagesSquare },
    { name: 'Equipos', path: '/admin/teams', icon: Users },
    { name: 'Grupos', path: '/admin/master-groups', icon: ListChecks },
    { name: 'Usuarios', path: '/admin/users', icon: UserCog },
    { name: 'Actividades', path: '/admin/activities', icon: Folder },
    { name: 'Procesos', path: '/admin/processes', icon: Settings },
    { name: 'Tareas', path: '/admin/tasks', icon: CheckSquare },
    { name: 'Criterios', path: '/admin/criteria', icon: ListChecks },
    { name: 'Indicadores', path: '/admin/indicators', icon: BarChart3 },
    { name: 'Categorías de Acción', path: '/admin/action-categories', icon: Tag },
    { name: 'Importación de maestros', path: '/admin/master-data', icon: Database },
    { name: 'Configuración', path: '/admin/parameters', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div 
        className={clsx(
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative group",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className={clsx("p-6 flex items-center justify-between", isCollapsed && "px-4")}>
          {!isCollapsed && (
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">GoZEN</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Lean & Visual</p>
            </div>
          )}
          {isCollapsed && (
            <div className="w-full flex justify-center">
              <span className="text-xl font-bold text-blue-600">G</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden pt-4">
          {/* Main Menu Link */}
          <Link
            to="/"
            title={isCollapsed ? "Menú Principal" : ""}
            className={clsx(
              'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mb-4 group/item',
              location.pathname === '/' 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100',
              isCollapsed && "justify-center"
            )}
          >
            <LayoutDashboard className={clsx('h-5 w-5 shrink-0', location.pathname === '/' ? 'text-blue-700' : 'text-gray-400', !isCollapsed && "mr-3")} />
            {!isCollapsed && <span className="truncate">Menú Principal</span>}
          </Link>

          {/* Top Level Items */}
          {topLevelItems.filter(item => item.roles.includes(dbUser?.role || 'user')).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                title={isCollapsed ? item.name : ""}
                className={clsx(
                  'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group/item',
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100',
                  isCollapsed && "justify-center"
                )}
              >
                <Icon className={clsx('h-5 w-5 shrink-0', isActive ? 'text-blue-700' : 'text-gray-400', !isCollapsed && "mr-3")} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}

          {/* Polivalencia Section */}
          <div className="mb-2">
            <button
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                  setIsPolivalenciaOpen(true);
                } else {
                  setIsPolivalenciaOpen(!isPolivalenciaOpen);
                }
              }}
              title={isCollapsed ? "Polivalencia" : ""}
              className={clsx(
                "w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors group/item",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              <div className="flex items-center">
                <Folder className={clsx('h-5 w-5 text-gray-400 shrink-0', !isCollapsed && "mr-3")} />
                {!isCollapsed && <span className="truncate">Polivalencia</span>}
              </div>
              {!isCollapsed && (
                isPolivalenciaOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                )
              )}
            </button>
            
            {isPolivalenciaOpen && !isCollapsed && (
              <div className="mt-1 ml-4 pl-4 border-l border-gray-200 space-y-1">
                {polivalenciaItems.filter(item => item.roles.includes(dbUser?.role || 'user')).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={clsx(
                        'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors group/item',
                        isActive 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <Icon className={clsx('mr-3 h-4 w-4 shrink-0', isActive ? 'text-blue-700' : 'text-gray-400')} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {isAdmin && (
            <>
              {!isCollapsed && (
                <div className="pt-6 pb-2">
                  <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                    Administración
                  </p>
                </div>
              )}
              {isCollapsed && <div className="pt-4 border-t border-gray-100 mt-4 mb-2 mx-2" />}
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    title={isCollapsed ? item.name : ""}
                    className={clsx(
                      'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group/item',
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100',
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className={clsx('h-5 w-5 shrink-0', isActive ? 'text-blue-700' : 'text-gray-400', !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className={clsx("p-4 border-t border-gray-200", isCollapsed && "flex justify-center")}>
          <button
            onClick={logout}
            title={isCollapsed ? "Cerrar sesión" : ""}
            className={clsx(
              "flex items-center px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors w-full group/item",
              isCollapsed && "justify-center"
            )}
          >
            <LogOut className={clsx('h-5 w-5 shrink-0', !isCollapsed && "mr-3")} />
            {!isCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20 h-[73px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600 group"
              title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={20} className="group-active:scale-95 transition-transform" />
              ) : (
                <PanelLeftClose size={20} className="group-active:scale-95 transition-transform" />
              )}
            </button>
            
            <div className="flex items-center gap-3">
              {company && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                  <Building2 size={14} />
                  {company.name}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{dbUser?.name}</p>
              <p className="text-xs text-gray-500 uppercase">{dbUser?.role}</p>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
