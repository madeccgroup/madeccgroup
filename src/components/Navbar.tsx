import { useState } from 'react';
import { 
  auth, 
  googleAuthProvider 
} from '../lib/firebase.ts';
import { signInWithPopup, signOut } from 'firebase/auth';
import { 
  HardHat, 
  Menu, 
  X, 
  User as UserIcon, 
  LogOut, 
  Key, 
  ChevronDown, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { User } from '../types.ts';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  dbUser: User | null;
  setDbUser: (user: User | null) => void;
  loadingAuth: boolean;
}

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  dbUser, 
  setDbUser, 
  loadingAuth 
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    setLoginError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      
      // Call our backend API to synchronize user
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.user) {
        setDbUser(data.user);
        setLoginModalOpen(false);
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user')) {
        setLoginError('The Google Sign-In popup was closed or blocked. If you are using an iframe preview, please allow popups/cookies, or open the app in a new tab.');
      } else {
        setLoginError(error?.message || 'Authentication failed. Please verify your connection.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setDbUser(null);
      setUserDropdownOpen(false);
      setCurrentTab('home');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'projects', label: 'Projects' },
    { id: 'blog', label: 'Blog' },
    { id: 'contact', label: 'Contact' },
    { id: 'booking', label: 'Book Consult' },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo Branding */}
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => setCurrentTab('home')}
            id="nav-logo"
          >
            <div className="h-12 w-12 bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden border border-slate-800/80 shadow-inner">
              <img 
                src="/src/assets/images/madecc_logo_1783370981722.jpg" 
                alt="MADECC Group Logo" 
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="font-sans font-extrabold text-xl tracking-tight text-white block">
                MADECC<span className="text-amber-500">GROUP</span>
              </span>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 block -mt-1">
                CONSTRUCTION & ENG
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMenuOpen(false);
                  }}
                  className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-colors ${
                    currentTab === item.id 
                      ? 'text-amber-400 bg-slate-800/60' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                  }`}
                  id={`nav-link-${item.id}`}
                >
                  {item.label}
                </button>
              ))}

              {/* Admin Button (Visible if admin/staff) */}
              {dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff') && (
                <button
                  onClick={() => setCurrentTab('admin')}
                  className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentTab === 'admin'
                      ? 'text-amber-400 bg-slate-800/60'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                  }`}
                  id="nav-link-admin"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  Admin
                </button>
              )}
            </div>

            {/* Auth section */}
            <div className="border-l border-slate-800 pl-6 flex items-center gap-3">
              {loadingAuth ? (
                <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin" />
              ) : dbUser ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg text-sm border border-slate-700 transition-colors"
                    id="user-menu-btn"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-900 text-xs">
                      {dbUser.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium max-w-[100px] truncate">{dbUser.name}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Signed in as</span>
                        <span className="block font-medium text-sm text-white truncate">{dbUser.email}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 mt-1">
                          Role: {dbUser.role}
                        </span>
                      </div>
                      

                      <div className="py-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-white text-left transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setLoginError(null);
                    setLoginModalOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-amber-500/15"
                  id="login-btn"
                >
                  <Key className="w-4 h-4" />
                  Sign In with Google
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-slate-400 hover:text-white p-2"
              id="mobile-menu-btn"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Panel */}
      {menuOpen && (
        <div className="md:hidden bg-slate-950 border-t border-slate-800 py-4 px-2 space-y-2 animate-in fade-in duration-100">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-md font-sans text-base font-medium block ${
                currentTab === item.id 
                  ? 'text-amber-400 bg-slate-900 border-l-4 border-amber-500' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}

          {dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff') && (
            <button
              onClick={() => {
                setCurrentTab('admin');
                setMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-md font-sans text-base font-medium flex items-center gap-2 ${
                currentTab === 'admin' 
                  ? 'text-amber-400 bg-slate-900 border-l-4 border-amber-500' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Admin Dashboard
            </button>
          )}

          <div className="border-t border-slate-800 pt-4 px-4 flex flex-col gap-3">
            {dbUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-900">
                    {dbUser.name[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-sm font-semibold">{dbUser.name}</span>
                    <span className="block text-xs text-slate-400 truncate">{dbUser.email}</span>
                  </div>
                </div>


                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setLoginError(null);
                  setLoginModalOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow"
              >
                <Key className="w-4 h-4" />
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sign In Dialog */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200" id="signin-modal">
            {/* Close Button */}
            <button 
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-2 mb-6">
              <div className="bg-amber-500/10 text-amber-500 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-white font-sans">MADECC Group Access</h3>
              <p className="text-xs text-slate-400">Sign in to manage projects, consults, and accounts.</p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-xs space-y-1.5 flex gap-3 items-start animate-in slide-in-from-top-2 duration-200" id="signin-error-banner">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-red-400">Authentication Warning</p>
                  <p className="leading-relaxed">{loginError}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4">
              {/* Primary Google Auth */}
              <button
                onClick={handleLogin}
                disabled={signingIn}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-amber-500/15 disabled:opacity-50"
                id="modal-google-signin-btn"
              >
                {signingIn ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Key className="w-4.5 h-4.5" />
                )}
                Sign In with Google
              </button>


            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
