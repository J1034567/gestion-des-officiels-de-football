
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import WhistleIcon from './icons/WhistleIcon';
import { useNotification } from '../hooks/useNotification';
import Toast from './Toast';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [view, setView] = useState<'login' | 'signup' | 'recovery'>('login');
  const [notification, showNotification, closeNotification] = useNotification();

  const handleAuth = async () => {
    setLoading(true);
    if (view === 'signup') {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });
        if (error) {
            showNotification(error.message, 'error');
        } else if (data.user?.identities?.length === 0) {
            showNotification("Inscription impossible, l'utilisateur existe peut-être déjà.", 'error');
        } else {
            showNotification("Inscription réussie ! Veuillez vérifier votre e-mail pour confirmer votre compte.", 'success');
            setView('login');
        }
    } else { // 'login' view
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showNotification(error.message, 'error');
        }
    }
    setLoading(false);
  };

  const handlePasswordRecovery = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      showNotification(error.message, 'error');
    } else {
      showNotification("Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.", 'success');
      setView('login');
    }
    setLoading(false);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (view === 'recovery') {
          handlePasswordRecovery();
      } else {
          handleAuth();
      }
  }

  const titles = {
      login: "Connectez-vous à votre compte",
      signup: "Créez votre compte",
      recovery: "Réinitialisez votre mot de passe"
  };
  
  const buttonLabels = {
      login: { default: 'Se connecter', loading: 'Connexion...' },
      signup: { default: 'Créer le compte', loading: 'Création...' },
      recovery: { default: 'Envoyer le lien', loading: 'Envoi...' },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      {notification && <Toast notification={notification} onClose={closeNotification} />}
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 space-y-6">
        <div className="flex flex-col items-center space-y-2">
            <WhistleIcon className="h-12 w-12 text-brand-primary" />
            <h1 className="text-3xl font-bold text-white">Gestion des Officiels</h1>
            <p className="text-gray-400">{titles[view]}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
            {view === 'signup' && (
                <div>
                    <label htmlFor="full-name" className="block text-sm font-medium text-gray-300">Nom complet</label>
                    <input
                        id="full-name"
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                        type="text"
                        placeholder="Votre nom complet"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        autoComplete="name"
                    />
                </div>
            )}
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">Adresse e-mail</label>
                <input
                    id="email"
                    className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                    type="email"
                    placeholder="votre.email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                />
            </div>
            {view !== 'recovery' && (
                <div>
                    <div className="flex justify-between items-center">
                        <label htmlFor="password"className="block text-sm font-medium text-gray-300">Mot de passe</label>
                        {view === 'login' && (
                            <button type="button" onClick={() => setView('recovery')} className="text-xs font-medium text-brand-primary hover:underline">
                                Mot de passe oublié ?
                            </button>
                        )}
                    </div>
                    <input
                        id="password"
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                        type="password"
                        placeholder="Votre mot de passe"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete={view === 'login' ? "current-password" : "new-password"}
                    />
                </div>
            )}
            
            <button 
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-wait"
                disabled={loading}
            >
                {loading ? buttonLabels[view].loading : buttonLabels[view].default}
            </button>
        </form>

        <p className="text-sm text-center text-gray-400">
            {view === 'login' && (
                 <>Pas encore de compte ? <button onClick={() => setView('signup')} className="font-medium text-brand-primary hover:underline ml-1">Inscrivez-vous</button></>
            )}
            {view === 'signup' && (
                <>Vous avez déjà un compte ? <button onClick={() => setView('login')} className="font-medium text-brand-primary hover:underline ml-1">Connectez-vous</button></>
            )}
             {view === 'recovery' && (
                <>Retour à la <button onClick={() => setView('login')} className="font-medium text-brand-primary hover:underline ml-1">connexion</button></>
            )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
