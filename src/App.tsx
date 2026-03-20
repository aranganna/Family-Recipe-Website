/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Clock, 
  Users, 
  X, 
  ChevronRight, 
  Heart,
  UtensilsCrossed,
  BookOpen,
  Image as ImageIcon,
  LogIn,
  LogOut,
  AlertCircle,
  Flame,
  Sprout
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  User 
} from './firebase';
import { INITIAL_RECIPES, type Recipe } from './data/recipes';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  LIST = 'list',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; errorInfo: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-cream">
          <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl text-center border border-blush">
            <AlertCircle className="w-16 h-16 text-rose mx-auto mb-6" />
            <h2 className="text-3xl serif mb-4">Oops!</h2>
            <p className="text-bark/70 mb-8">Something went wrong. Please try again later.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-saffron text-white rounded-full font-bold shadow-lg hover:bg-rose transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CATEGORIES = ['All', 'Breakfast', 'Rice', 'Curry', 'Lentils', 'Chutney', 'Snack', 'Sweet', 'Other'];

function HeritageHearth() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time recipe listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setRecipes([]);
      return;
    }

    const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecipes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Recipe[];
      
      // Combine initial recipes with DB recipes, avoiding duplicates
      const allRecipes = [...dbRecipes];
      INITIAL_RECIPES.forEach(initial => {
        if (!allRecipes.find(r => r.id === initial.id)) {
          allRecipes.push(initial);
        }
      });
      
      setRecipes(allRecipes.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recipes');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleAddRecipe = async (newRecipe: Omit<Recipe, 'id' | 'createdAt' | 'authorId'>) => {
    if (!user) return;
    
    const recipeData = {
      ...newRecipe,
      authorId: user.uid,
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'recipes'), recipeData);
      setIsFormOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'recipes');
    }
  };

  const filteredRecipes = recipes.filter(r => {
    const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (r.kannada && r.kannada.includes(searchQuery)) ||
                         r.contributor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Flame className="w-12 h-12 text-saffron" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-6 rangoli-pattern">
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-12 rounded-[3rem] shadow-2xl border border-blush relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-5 rangoli-bg" />
            <div className="relative">
              <div className="w-20 h-20 bg-deep-green rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
                <Flame className="w-10 h-10 text-marigold" />
              </div>
              <h1 className="text-4xl serif mb-2 text-bark">ನಮ್ಮ ಅಡುಗೆ</h1>
              <h2 className="text-2xl serif mb-6 text-saffron italic">Our Family Recipes</h2>
              <p className="text-bark/60 mb-10 leading-relaxed font-light">
                Welcome to our family's digital recipe chest. Please sign in to access our shared culinary legacy.
              </p>
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full py-5 bg-saffron text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-rose transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-6 h-6" />
                    Sign in with Google
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 rangoli-pattern">
      {/* Header */}
      <header className="relative h-[45vh] flex items-center justify-center overflow-hidden bg-deep-green">
        <div className="absolute inset-0 opacity-10 rangoli-bg" />
        <div className="absolute top-0 left-0 right-0 h-2 header-border" />
        <div className="absolute top-8 right-8 z-20">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-sm font-medium border border-white/20 hover:bg-white/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
        <div className="relative text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-3 bg-white/10 backdrop-blur-md rounded-full mb-6 border border-white/20"
          >
            <Flame className="w-8 h-8 text-marigold" />
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="kannada text-marigold text-xl mb-2 tracking-widest"
          >
            ನಮ್ಮ ಕುಟುಂಬದ ಅಡುಗೆ ಪುಸ್ತಕ
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl serif text-jasmine mb-4 tracking-tight"
          >
            Our Family <em className="text-marigold not-italic">Recipe</em> Book
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto font-light italic"
          >
            Passed down with love · ಪ್ರೀತಿಯಿಂದ ನೀಡಲಾಗಿದೆ
          </motion.p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 -mt-12 relative z-10">
        {/* Search and Filter */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-12 border border-blush">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-bark/30" />
              <input 
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron transition-all text-bark"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                    selectedCategory === cat 
                      ? "bg-saffron text-white shadow-lg" 
                      : "bg-cream text-bark/60 hover:bg-blush"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredRecipes.map((recipe, index) => (
              <motion.div
                key={recipe.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedRecipe(recipe)}
                className="group bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all cursor-pointer border border-blush"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img 
                    src={recipe.photo || `https://picsum.photos/seed/${recipe.id}/800/600`} 
                    alt={recipe.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 px-4 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-saffron uppercase tracking-widest">
                    {recipe.category}
                  </div>
                  {!recipe.photo && (
                    <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">
                      {recipe.emoji || '🥘'}
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-2 text-xs text-bark/40 mb-3 uppercase tracking-widest font-bold">
                    <BookOpen className="w-3 h-3" />
                    <span>By {recipe.contributor || 'Family'}</span>
                  </div>
                  <h3 className="text-2xl serif mb-1 text-bark group-hover:text-saffron transition-colors">
                    {recipe.name}
                  </h3>
                  {recipe.kannada && (
                    <p className="kannada text-saffron text-sm mb-3">{recipe.kannada}</p>
                  )}
                  <div className="flex items-center justify-between pt-6 border-t border-blush">
                    <div className="flex items-center gap-4 text-bark/40">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold">{recipe.prepTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold">Serves {recipe.servings}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-cream flex items-center justify-center group-hover:bg-saffron group-hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-20">
            <UtensilsCrossed className="w-16 h-16 text-blush mx-auto mb-4" />
            <h3 className="text-xl serif text-bark/30">No recipes found in this category.</h3>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsFormOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-saffron text-white rounded-full shadow-2xl flex items-center justify-center z-50 hover:bg-rose transition-colors"
      >
        <Plus className="w-8 h-8" />
      </motion.button>

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <Modal onClose={() => setSelectedRecipe(null)}>
            <div className="max-w-4xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row border border-blush">
              <div className="md:w-1/2 h-64 md:h-auto relative">
                <img 
                  src={selectedRecipe.photo || `https://picsum.photos/seed/${selectedRecipe.id}/800/600`} 
                  alt={selectedRecipe.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-6 left-6 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-bark md:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="md:w-1/2 p-10 md:p-14 overflow-y-auto max-h-[80vh]">
                <div className="hidden md:flex justify-end mb-4">
                  <button onClick={() => setSelectedRecipe(null)} className="text-bark/30 hover:text-bark/60">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="text-xs font-bold text-saffron uppercase tracking-widest mb-2">
                  {selectedRecipe.category}
                </div>
                <h2 className="text-4xl serif mb-1 text-bark">{selectedRecipe.name}</h2>
                {selectedRecipe.kannada && (
                  <p className="kannada text-saffron text-xl mb-4">{selectedRecipe.kannada}</p>
                )}
                
                <div className="grid grid-cols-2 gap-6 mb-10 p-6 bg-cream rounded-3xl">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-bark/40 font-bold mb-1">Prep Time</div>
                    <div className="flex items-center gap-2 text-bark/70">
                      <Clock className="w-4 h-4" />
                      <span className="font-bold">{selectedRecipe.prepTime}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-bark/40 font-bold mb-1">Servings</div>
                    <div className="flex items-center gap-2 text-bark/70">
                      <Users className="w-4 h-4" />
                      <span className="font-bold">{selectedRecipe.servings}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-10">
                  <h3 className="text-xl serif mb-4 flex items-center gap-2 text-saffron">
                    <Sprout className="w-5 h-5" />
                    Ingredients
                  </h3>
                  <ul className="space-y-3">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-3 text-bark/70 border-b border-blush border-dashed pb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-saffron mt-2 shrink-0" />
                        <span className="text-sm">{ing}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-10">
                  <h3 className="text-xl serif mb-4 flex items-center gap-2 text-saffron">
                    <UtensilsCrossed className="w-5 h-5" />
                    Method
                  </h3>
                  <div className="space-y-6">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="w-6 h-6 bg-saffron text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">{i + 1}</span>
                        <p className="text-bark/70 text-sm leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedRecipe.notes && (
                  <div className="mb-10 p-6 bg-jasmine rounded-3xl border border-marigold/20">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-marigold mb-2">Notes & Tips</h3>
                    <p className="text-bark/60 text-sm italic leading-relaxed">{selectedRecipe.notes}</p>
                  </div>
                )}

                <div className="mt-12 pt-8 border-t border-blush text-xs text-bark/40 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-teal">Contributed by {selectedRecipe.contributor || 'Family'}</span>
                    <span>{new Date(selectedRecipe.createdAt).toLocaleDateString()}</span>
                  </div>
                  {selectedRecipe.contributorNote && (
                    <p className="italic text-bark/50 border-l-2 border-teal pl-3 py-1">{selectedRecipe.contributorNote}</p>
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Add Recipe Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <Modal onClose={() => setIsFormOpen(false)}>
            <div className="max-w-2xl w-full bg-white rounded-[2.5rem] p-10 md:p-14 shadow-2xl overflow-y-auto max-h-[90vh] border border-blush relative">
              <div className="absolute inset-0 opacity-5 rangoli-bg pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-4xl serif text-bark">Submit Recipe</h2>
                  <button onClick={() => setIsFormOpen(false)} className="text-bark/30 hover:text-bark/60">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleAddRecipe({
                    name: formData.get('name') as string,
                    kannada: formData.get('kannada') as string,
                    category: formData.get('category') as string,
                    prepTime: formData.get('prepTime') as string,
                    cookTime: formData.get('cookTime') as string,
                    servings: formData.get('servings') as string,
                    ingredients: (formData.get('ingredients') as string).split('\n').filter(i => i.trim()),
                    steps: (formData.get('steps') as string).split('\n').filter(i => i.trim()),
                    notes: formData.get('notes') as string,
                    photo: formData.get('photo') as string,
                    contributor: formData.get('contributor') as string,
                  });
                }} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Recipe Name (English)</label>
                      <input required name="name" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="e.g. Bisi Bele Bath" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Kannada Name</label>
                      <input name="kannada" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="ಬಿಸಿ ಬೇಳೆ ಬಾತ್" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Category</label>
                      <select name="category" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark appearance-none">
                        {CATEGORIES.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Your Name</label>
                      <input required name="contributor" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="Who is sharing this?" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Prep Time</label>
                      <input required name="prepTime" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="20 mins" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Cook Time</label>
                      <input required name="cookTime" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="40 mins" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Servings</label>
                      <input required name="servings" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="4-6" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Ingredients (One per line)</label>
                    <textarea required name="ingredients" rows={4} className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="2 cups rice&#10;1 cup toor dal..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Method / Steps (One per line)</label>
                    <textarea required name="steps" rows={6} className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="Cook dal until soft.&#10;Fry mustard seeds..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40">Notes / Tips</label>
                    <textarea name="notes" rows={2} className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="Ajji's secret tip..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bark/40 flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      Photo URL (Optional)
                    </label>
                    <input name="photo" className="w-full px-6 py-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-saffron text-bark" placeholder="https://..." />
                  </div>

                  <button type="submit" className="w-full py-5 bg-saffron text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-rose transition-all transform hover:-translate-y-1">
                    Save to Family Book
                  </button>
                </form>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 py-12 border-t border-blush text-center">
        <p className="kannada text-saffron text-lg mb-2">ಪ್ರೀತಿ ಮತ್ತು ಸ್ಮರಣೆಯಿಂದ ತಯಾರಿಸಲಾಗಿದೆ</p>
        <p className="text-bark/40 text-sm serif italic">"Made with love & memory · A living recipe book, growing with every generation"</p>
        <p className="text-bark/20 text-[10px] uppercase tracking-[0.2em] mt-4">ನಮ್ಮ ಅಡುಗೆ &copy; 2026</p>
      </footer>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10"
    >
      <div className="absolute inset-0 bg-bark/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative z-10 w-full flex justify-center"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HeritageHearth />
    </ErrorBoundary>
  );
}

