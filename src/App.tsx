import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { User } from './types.ts';

// Layout & Core Global Components
import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import FloatingContactHub from './components/FloatingContactHub.tsx';
import SEOHandler from './components/SEOHandler.tsx';

// Tab Screens
import Home from './components/Home.tsx';
import About from './components/About.tsx';
import Projects from './components/Projects.tsx';
import Blog from './components/Blog.tsx';
import Contact from './components/Contact.tsx';
import Booking from './components/Booking.tsx';
import Admin from './components/Admin.tsx';
import VerifyContract from './components/VerifyContract.tsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [verificationToken, setVerificationToken] = useState<string>('');

  // Sync contract verification tokens from query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify') || params.get('verifyToken');
    if (verifyToken) {
      setVerificationToken(verifyToken);
      setCurrentTab('verify');
    }
  }, []);

  // Sync Firebase authentication with our PostgreSQL user roles
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setDbUser(data.user);
            }
          }
        } catch (error) {
          console.error('Error synchronizing authenticated profile:', error);
        }
      } else {
        setDbUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Scroll to top of page whenever tab transitions occur
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab, selectedProjectId]);

  // Handle instant redirect if admin/staff role is revoked during sandbox toggling
  useEffect(() => {
    if (currentTab === 'admin') {
      if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'staff')) {
        setCurrentTab('home');
      }
    }
  }, [dbUser, currentTab]);

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'home':
        return (
          <Home 
            setCurrentTab={setCurrentTab} 
            setSelectedProjectId={setSelectedProjectId} 
          />
        );
      case 'about':
        return <About />;
      case 'projects':
        return (
          <Projects 
            selectedProjectId={selectedProjectId} 
            setSelectedProjectId={setSelectedProjectId} 
          />
        );
      case 'blog':
        return <Blog />;
      case 'contact':
        return <Contact />;
      case 'booking':
        return <Booking />;
      case 'verify':
        return (
          <VerifyContract 
            token={verificationToken} 
            onBackToHome={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('verify');
              url.searchParams.delete('verifyToken');
              window.history.pushState({}, '', url.toString());
              setCurrentTab('home');
              setVerificationToken('');
            }} 
          />
        );
      case 'admin':
        return (
          <Admin 
            dbUser={dbUser} 
            setDbUser={setDbUser} 
            setCurrentTab={setCurrentTab} 
            setVerificationToken={setVerificationToken}
          />
        );
      default:
        return (
          <Home 
            setCurrentTab={setCurrentTab} 
            setSelectedProjectId={setSelectedProjectId} 
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-amber-500 selection:text-slate-950">
      <SEOHandler currentTab={currentTab} selectedProjectId={selectedProjectId} />
      
      {/* Header Navigation Section */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'projects') setSelectedProjectId(null); // Reset selection
        }} 
        dbUser={dbUser} 
        setDbUser={setDbUser} 
        loadingAuth={loadingAuth}
      />

      {/* Main Content View with transition wrapper */}
      <main className="flex-grow">
        {loadingAuth ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <div className="w-10 h-10 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Verifying secure profile...</span>
          </div>
        ) : (
          renderActiveScreen()
        )}
      </main>

      {/* Footer Navigation section */}
      <Footer 
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'projects') setSelectedProjectId(null); // Reset selection
        }} 
      />

      {/* Floating Interactive Live Hub widget */}
      <FloatingContactHub />

    </div>
  );
}
