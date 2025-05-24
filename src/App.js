import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, Dumbbell, Settings, Plus, Save, Menu, X, LogOut, UserPlus, LogIn } from 'lucide-react';
import MuscleVisualizer from './components/MuscleVisualizer';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  getDocs,
  Timestamp
} from 'firebase/firestore';

const WorkoutTrackerApp = () => {
  const [currentWindow, setCurrentWindow] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [workoutDays, setWorkoutDays] = useState(3);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [workoutData, setWorkoutData] = useState({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [authError, setAuthError] = useState('');

  const exerciseDatabase = useMemo(() => ({
    push: [
      { name: 'Bench Press', muscleGroup: 'Chest', sets: 3, reps: 8, visualTarget: ['chest', 'front-deltoids', 'triceps'] },
      { name: 'Push-ups', muscleGroup: 'Chest', sets: 3, reps: 12, visualTarget: ['chest', 'front-deltoids', 'triceps', 'abs'] },
      { name: 'Shoulder Press', muscleGroup: 'Shoulders', sets: 3, reps: 10, visualTarget: ['front-deltoids', 'triceps'] },
      { name: 'Tricep Dips', muscleGroup: 'Triceps', sets: 3, reps: 10, visualTarget: ['triceps', 'chest', 'front-deltoids'] },
      { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', sets: 3, reps: 10, visualTarget: ['chest', 'front-deltoids', 'triceps'] }
    ],
    pull: [
      { name: 'Pull-ups', muscleGroup: 'Back', sets: 3, reps: 8, visualTarget: ['upper-back', 'biceps', 'forearm'] },
      { name: 'Bent-over Rows', muscleGroup: 'Back', sets: 3, reps: 10, visualTarget: ['upper-back', 'lower-back', 'biceps'] },
      { name: 'Lat Pulldowns', muscleGroup: 'Back', sets: 3, reps: 10, visualTarget: ['upper-back', 'biceps'] },
      { name: 'Bicep Curls', muscleGroup: 'Biceps', sets: 3, reps: 12, visualTarget: ['biceps', 'forearm'] },
      { name: 'Face Pulls', muscleGroup: 'Rear Delts', sets: 3, reps: 15, visualTarget: ['back-deltoids', 'trapezius'] }
    ],
    legs: [
      { name: 'Squats', muscleGroup: 'Quads', sets: 3, reps: 10, visualTarget: ['quadriceps', 'gluteal', 'hamstring', 'abs'] },
      { name: 'Deadlifts', muscleGroup: 'Hamstrings', sets: 3, reps: 8, visualTarget: ['hamstring', 'gluteal', 'lower-back', 'trapezius', 'forearm'] },
      { name: 'Lunges', muscleGroup: 'Legs', sets: 3, reps: 12, visualTarget: ['quadriceps', 'gluteal', 'hamstring'] },
      { name: 'Calf Raises', muscleGroup: 'Calves', sets: 3, reps: 15, visualTarget: ['calves'] },
      { name: 'Leg Press', muscleGroup: 'Quads', sets: 3, reps: 12, visualTarget: ['quadriceps', 'gluteal', 'hamstring', 'adductor'] }
    ]
  }), []);

  const internalGenerateWorkoutPlan = useCallback((days) => {
    const plans = {
      2: [
        { day: 'Day 1', type: 'Upper Body', exercises: [...exerciseDatabase.push.slice(0, 3), ...exerciseDatabase.pull.slice(0, 2)] },
        { day: 'Day 2', type: 'Lower Body', exercises: exerciseDatabase.legs }
      ],
      3: [
        { day: 'Day 1', type: 'Push', exercises: exerciseDatabase.push },
        { day: 'Day 2', type: 'Pull', exercises: exerciseDatabase.pull },
        { day: 'Day 3', type: 'Legs', exercises: exerciseDatabase.legs }
      ],
      4: [
        { day: 'Day 1', type: 'Upper Push', exercises: exerciseDatabase.push },
        { day: 'Day 2', type: 'Lower Body', exercises: exerciseDatabase.legs },
        { day: 'Day 3', type: 'Upper Pull', exercises: exerciseDatabase.pull },
        { day: 'Day 4', type: 'Full Body', exercises: [...exerciseDatabase.push.slice(0, 2), ...exerciseDatabase.pull.slice(0, 2), ...exerciseDatabase.legs.slice(0, 2)] }
      ],
      5: [
        { day: 'Day 1', type: 'Push', exercises: exerciseDatabase.push },
        { day: 'Day 2', type: 'Pull', exercises: exerciseDatabase.pull },
        { day: 'Day 3', type: 'Legs', exercises: exerciseDatabase.legs },
        { day: 'Day 4', type: 'Push', exercises: exerciseDatabase.push },
        { day: 'Day 5', type: 'Pull', exercises: exerciseDatabase.pull }
      ],
      6: [
        { day: 'Day 1', type: 'Push', exercises: exerciseDatabase.push },
        { day: 'Day 2', type: 'Pull', exercises: exerciseDatabase.pull },
        { day: 'Day 3', type: 'Legs', exercises: exerciseDatabase.legs },
        { day: 'Day 4', type: 'Push', exercises: exerciseDatabase.push },
        { day: 'Day 5', type: 'Pull', exercises: exerciseDatabase.pull },
        { day: 'Day 6', type: 'Legs', exercises: exerciseDatabase.legs }
      ]
    };
    return plans[days] || plans[3];
  }, [exerciseDatabase]);

  const saveUserPreferencesToFirestore = useCallback(async (userId, preferences) => {
    if(!userId || !preferences) return;
    try {
        const userPrefsDocRef = doc(db, 'users', userId, 'preferences');
        await setDoc(userPrefsDocRef, preferences, { merge: true });
    } catch (error) {
        console.error("Error saving user preferences: ", error);
    }
  }, []);

  const generateAndSaveWorkoutPlan = useCallback(async (daysToGenerate, userIdForSave) => {
    const newPlan = internalGenerateWorkoutPlan(daysToGenerate);
    setWorkoutPlan(newPlan);
    if (userIdForSave) {
      await saveUserPreferencesToFirestore(userIdForSave, { workoutDays: daysToGenerate, workoutPlan: newPlan });
    }
    return newPlan;
  }, [internalGenerateWorkoutPlan, saveUserPreferencesToFirestore]);

  const loadWorkoutDataFromFirestore = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const historyCollectionRef = collection(db, 'users', userId, 'workoutHistory');
      const q = query(historyCollectionRef, orderBy('completedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const history = [];
      const newWorkoutData = {};

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const workoutEntry = { 
          id: docSnap.id, 
          ...data,
          date: data.date instanceof Timestamp ? data.date.toDate().toISOString().split('T')[0] : data.date,
          completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : data.completedAt,
        };
        history.push(workoutEntry);
        (data.exercises || []).forEach(exercise => {
          const exerciseName = exercise.name;
          const maxWeight = Math.max(...(exercise.sets || []).filter(set => set.weight && set.reps).map(set => parseFloat(set.weight) || 0));
          const totalVolume = (exercise.sets || []).reduce((sum, set) => {
            const weight = parseFloat(set.weight) || 0;
            const reps = parseInt(set.reps) || 0;
            return sum + (weight * reps);
          }, 0);
          if (maxWeight > 0 || totalVolume > 0) {
            if (!newWorkoutData[exerciseName]) newWorkoutData[exerciseName] = [];
            newWorkoutData[exerciseName].push({ date: workoutEntry.date, maxWeight, totalVolume, workout: workoutEntry.type });
          }
        });
      });
      setWorkoutHistory(history);
      setWorkoutData(newWorkoutData);

      const userPrefsDocRef = doc(db, 'users', userId, 'preferences');
      const userPrefsSnap = await getDoc(userPrefsDocRef);
      let loadedDays = 3;
      let loadedPlan = null;

      if (userPrefsSnap.exists()) {
        const prefs = userPrefsSnap.data();
        loadedDays = prefs.workoutDays || 3;
        loadedPlan = prefs.workoutPlan && prefs.workoutPlan.length > 0 ? prefs.workoutPlan : null;
        setWorkoutDays(loadedDays);
      }
      
      if (loadedPlan) {
        setWorkoutPlan(loadedPlan);
        setCurrentWindow('dashboard');
      } else {
        await generateAndSaveWorkoutPlan(loadedDays, userId);
        if (history.length === 0) {
            setCurrentWindow('setup');
        } else {
            setCurrentWindow('dashboard');
        }
      }

    } catch (error) {
      console.error("Error loading workout data: ", error);
      setAuthError("Failed to load workout data.");
      setCurrentWindow('login');
    }
  }, [generateAndSaveWorkoutPlan]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadWorkoutDataFromFirestore(user.uid);
      } else {
        setCurrentUser(null);
        setCurrentWindow('login');
        setWorkoutHistory([]);
        setWorkoutData({});
        setWorkoutPlan([]);
        setWorkoutDays(3);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, [loadWorkoutDataFromFirestore]);
  
  const saveWorkoutHistoryEntryToFirestore = async (userId, workoutEntry) => {
    if (!userId || !workoutEntry) return;
    try {
      const entryToSave = {
        ...workoutEntry,
        date: workoutEntry.date,
        completedAt: Timestamp.fromDate(new Date(workoutEntry.completedAt)),
      };
      const newEntryRef = doc(collection(db, "users", userId, "workoutHistory"));
      await setDoc(newEntryRef, entryToSave);
    } catch (error) {
      console.error("Error saving workout history entry: ", error);
      setAuthError("Failed to save workout.");
    }
  };

  const startWorkout = (workout) => {
    const workoutWithData = {
      ...workout,
      date: new Date().toISOString().split('T')[0],
      exercises: workout.exercises.map(ex => ({
        ...ex,
        sets: Array(ex.sets || 3).fill().map(() => ({ weight: '', reps: '', completed: false }))
      }))
    };
    setCurrentWorkout(workoutWithData);
    setCurrentWindow('workout');
  };

  const updateExerciseSet = (exerciseIndex, setIndex, field, value) => {
    setCurrentWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, ei) => 
        ei === exerciseIndex 
          ? {
              ...ex,
              sets: ex.sets.map((set, si) => 
                si === setIndex ? { ...set, [field]: value } : set
              )
            }
          : ex
      )
    }));
  };

  const completeWorkout = () => {
    if (currentWorkout && currentUser) {
      const completedWorkout = {
        ...currentWorkout,
        completedAt: new Date().toISOString()
      };
      saveWorkoutHistoryEntryToFirestore(currentUser.uid, completedWorkout);
      setWorkoutHistory(prev => [completedWorkout, ...prev].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
      const newWorkoutDataForCurrentSession = {};
      currentWorkout.exercises.forEach(exercise => {
        const exerciseName = exercise.name;
        const maxWeight = Math.max(...(exercise.sets || []).filter(set => set.weight && set.reps).map(set => parseFloat(set.weight) || 0));
        const totalVolume = (exercise.sets || []).reduce((sum, set) => {
          const weight = parseFloat(set.weight) || 0;
          const reps = parseInt(set.reps) || 0;
          return sum + (weight * reps);
        }, 0);
        if (maxWeight > 0 || totalVolume > 0) {
          if(!newWorkoutDataForCurrentSession[exerciseName]) newWorkoutDataForCurrentSession[exerciseName] = [];
          newWorkoutDataForCurrentSession[exerciseName].push({
            date: currentWorkout.date,
            maxWeight,
            totalVolume,
            workout: currentWorkout.type
          });
        }
      });
      setWorkoutData(prev => {
        const updatedData = { ...prev };
        Object.keys(newWorkoutDataForCurrentSession).forEach(exName => {
          updatedData[exName] = [...(updatedData[exName] || []), ...newWorkoutDataForCurrentSession[exName]]
                                .sort((a,b) => new Date(a.date) - new Date(b.date));
        });
        return updatedData;
      });
      setCurrentWorkout(null);
      setCurrentWindow('dashboard');
    } else if (!currentUser) {
      setAuthError("You must be logged in to save a workout.");
      setCurrentWindow('login');
    }
  };

  const getTotalVolumeData = () => {
    const volumeByDate = {};
    Object.values(workoutData).flat().forEach(entry => {
      if (volumeByDate[entry.date]) {
        volumeByDate[entry.date] += entry.totalVolume;
      } else {
        volumeByDate[entry.date] = entry.totalVolume;
      }
    });
    
    return Object.entries(volumeByDate).map(([date, volume]) => ({
      date,
      volume
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const handleSignup = async (email, password) => {
    setAuthError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await generateAndSaveWorkoutPlan(3, user.uid);
    } catch (error) {
      console.error("Signup error:", error);
      setAuthError(error.message);
    }
  };

  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    setAuthError('');
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      setAuthError(error.message);
    }
  };

  const LoginWindow = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
      <div className="min-h-screen bg-[#2E2E30] flex items-center justify-center p-4">
        <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-[#808080]/30 shadow-xl">
          <div className="text-center mb-6">
            <LogIn className="w-12 h-12 text-[#F5F5F5] mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-[#F5F5F5]">Login</h1>
          </div>
          {authError && <p className="text-sm text-[#C51D34] bg-[#C51D34]/20 p-3 rounded-md mb-4 text-center">{authError}</p>}
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(email, password); }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#F5F5F5] mb-1.5">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="w-full px-4 py-2.5 bg-[#2E2E30]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#F5F5F5] mb-1.5">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="w-full px-4 py-2.5 bg-[#2E2E30]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34]"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-[#C51D34] text-[#F5F5F5] py-3 rounded-lg font-semibold hover:bg-[#B01A2E] transition-colors"
            >
              Log In
            </button>
          </form>
          <p className="text-center text-sm text-[#F5F5F5]/70 mt-6">
            Don't have an account? 
            <button onClick={() => { setCurrentWindow('signup'); setAuthError(''); }} className="font-semibold text-[#C51D34] hover:underline">
              Sign Up
            </button>
          </p>
        </div>
      </div>
    );
  };

  const SignupWindow = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (password !== confirmPassword) {
        setAuthError("Passwords don't match.");
        return;
      }
      handleSignup(email, password);
    };

    return (
      <div className="min-h-screen bg-[#2E2E30] flex items-center justify-center p-4">
        <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-[#808080]/30 shadow-xl">
          <div className="text-center mb-6">
            <UserPlus className="w-12 h-12 text-[#F5F5F5] mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-[#F5F5F5]">Create Account</h1>
          </div>
          {authError && <p className="text-sm text-[#C51D34] bg-[#C51D34]/20 p-3 rounded-md mb-4 text-center">{authError}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#F5F5F5] mb-1.5">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="w-full px-4 py-2.5 bg-[#2E2E30]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#F5F5F5] mb-1.5">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="w-full px-4 py-2.5 bg-[#2E2E30]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#F5F5F5] mb-1.5">Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                className="w-full px-4 py-2.5 bg-[#2E2E30]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34]"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-[#C51D34] text-[#F5F5F5] py-3 rounded-lg font-semibold hover:bg-[#B01A2E] transition-colors"
            >
              Sign Up
            </button>
          </form>
          <p className="text-center text-sm text-[#F5F5F5]/70 mt-6">
            Already have an account? 
            <button onClick={() => { setCurrentWindow('login'); setAuthError(''); }} className="font-semibold text-[#C51D34] hover:underline">
              Log In
            </button>
          </p>
        </div>
      </div>
    );
  };

  const SetupWindow = () => (
    <div className="min-h-screen bg-[#2E2E30] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-3xl p-6 sm:p-8 w-full max-w-md border border-[#808080]/30 shadow-2xl">
        <div className="text-center mb-6 sm:mb-8">
          <Dumbbell className="w-12 h-12 sm:w-16 sm:h-16 text-[#F5F5F5] mx-auto mb-3 sm:mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] mb-1 sm:mb-2">Workout Setup</h1>
          <p className="text-sm sm:text-base text-[#F5F5F5]/80">Customize your workout plan.</p>
        </div>
        
        <div className="space-y-5 sm:space-y-6">
          <div>
            <label className="block text-[#F5F5F5] text-sm font-semibold mb-2 sm:mb-3">
              How many days per week do you want to workout?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {[2, 3, 4, 5, 6].map(days => (
                <button
                  key={days}
                  onClick={() => setWorkoutDays(days)}
                  className={`p-3 rounded-xl font-semibold transition-all text-sm sm:text-base ${
                    workoutDays === days
                      ? 'bg-[#C51D34] text-[#F5F5F5] shadow-lg transform scale-105'
                      : 'bg-[#808080]/30 text-[#F5F5F5] hover:bg-[#808080]/50'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={async () => {
              if (currentUser) {
                await generateAndSaveWorkoutPlan(workoutDays, currentUser.uid);
                setCurrentWindow('dashboard');
              } else {
                setAuthError("Please log in to create a plan.");
                setCurrentWindow('login');
              }
            }}
            className="w-full bg-[#C51D34] text-[#F5F5F5] py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-[#B01A2E] transform hover:scale-105 transition-all"
          >
            Update My Workout Plan
          </button>
           { currentUser && workoutPlan && workoutPlan.length > 0 && (
             <button
                onClick={() => setCurrentWindow('dashboard')}
                className="w-full bg-[#808080]/50 text-[#F5F5F5] py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-[#808080]/70 transition-all mt-3"
             >
                Go to Dashboard
            </button>
           )}
        </div>
      </div>
    </div>
  );

  const AppNavbar = ({ title, children }) => {
    return (
      <nav className="bg-[#252527]/90 backdrop-blur-lg border-b border-[#808080]/30 p-4 sticky top-0 z-50">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F5F5]">{title}</h1>
          <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[#F5F5F5] p-2">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
          <div className="hidden md:flex gap-2 items-center">
            {children}
            <button 
              onClick={handleLogout} 
              className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/30 hover:bg-[#808080]/50 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#808080]/30">
            <div className="flex flex-col gap-3 items-center">
              {children}
              <button 
                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/30 hover:bg-[#808080]/50 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
    );
  };

  const DashboardWindow = () => (
    <div className="min-h-screen bg-[#2E2E30] text-[#F5F5F5]">
      <AppNavbar title="Workout Dashboard">
        <button
          onClick={() => { setCurrentWindow('plan'); setIsMobileMenuOpen(false); }}
          className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/50 hover:bg-[#808080]/70 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Plan
        </button>
        <button
          onClick={() => { setCurrentWindow('progress'); setIsMobileMenuOpen(false); }}
          className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/50 hover:bg-[#808080]/70 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Progress
        </button>
        <button
          onClick={() => { setCurrentWindow('setup'); setIsMobileMenuOpen(false); }}
          className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#C51D34] hover:bg-[#B01A2E] text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Setup
        </button>
      </AppNavbar>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-[#F5F5F5]">Total Workouts</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#C51D34]">{workoutHistory.length}</p>
          </div>
          <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-[#F5F5F5]">This Week</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#C51D34]">
              {workoutHistory.filter(w => {
                const workoutDate = new Date(w.date);
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                const weekStart = new Date(today.setDate(diff));
                weekStart.setHours(0,0,0,0);
                return workoutDate >= weekStart;
              }).length}
            </p>
          </div>
          <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-[#F5F5F5]">Workout Days</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#C51D34]">{workoutDays}/week</p>
          </div>
        </div>

        <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
          <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-[#F5F5F5]">Recent Activity</h3>
          {workoutHistory.length === 0 ? (
            <p className="text-[#808080] text-sm sm:text-base">No workouts completed yet. Start your fitness journey!</p>
          ) : (
            <div className="space-y-3">
              {workoutHistory.slice(-5).reverse().map((workout, index) => (
                <div key={index} className="flex justify-between items-center p-3 sm:p-4 bg-[#2E2E30]/50 rounded-xl">
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base text-[#F5F5F5]">{workout.type || 'Workout'}</h4>
                    <p className="text-xs sm:text-sm text-[#808080]">{new Date(workout.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-[#C51D34]">Completed</p>
                    <p className="text-xs text-[#808080]">{workout.exercises.length} exercises</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const WorkoutPlanWindow = () => (
    <div className="min-h-screen bg-[#2E2E30] text-[#F5F5F5]">
       <AppNavbar title="Workout Plan">
         <button
            onClick={() => { setCurrentWindow('dashboard'); setIsMobileMenuOpen(false); }}
            className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/50 hover:bg-[#808080]/70 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Back to Dashboard
          </button>
      </AppNavbar>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {workoutPlan.map((workout, index) => (
            <div key={index} className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-3 sm:mb-4">
                  <div className="mb-2 sm:mb-0">
                    <h3 className="text-lg sm:text-xl font-bold text-[#F5F5F5]">{workout.day}</h3>
                    <p className="text-sm sm:text-base text-[#C51D34]/90">{workout.type}</p>
                  </div>
                  <button
                    onClick={() => startWorkout(workout)}
                    className="w-full sm:w-auto px-3 py-1.5 text-sm bg-[#C51D34] hover:bg-[#B01A2E] text-[#F5F5F5] rounded-lg hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Start
                  </button>
                </div>
                
                <div className="space-y-3">
                  {workout.exercises.map((exercise, ei) => (
                    <div key={ei} className="bg-[#2E2E30]/50 p-3 rounded-lg">
                      <div className="flex justify-between items-center text-xs sm:text-sm mb-1 sm:mb-2">
                        <span className="font-semibold text-[#F5F5F5] truncate pr-2" title={exercise.name}>{exercise.name}</span>
                        <span className="text-[#808080] whitespace-nowrap">{exercise.sets}x{exercise.reps}</span>
                      </div>
                      <div className="my-2 flex justify-center h-28 sm:h-32 md:h-36">
                          <MuscleVisualizer exerciseToDisplay={exercise.visualTarget || []} type="anterior" />
                      </div>
                      <div className="mt-1 text-xs text-[#C51D34]/80 text-center capitalize">
                         {exercise.visualTarget ? exercise.visualTarget.join(', ').replace(/-/g, ' ') : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const WorkoutWindow = () => (
    <div className="min-h-screen bg-[#2E2E30] text-[#F5F5F5]">
      <AppNavbar title={currentWorkout?.type || "Workout"}>
        <button
            onClick={completeWorkout}
            className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#C51D34] hover:bg-[#B01A2E] text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Complete
        </button>
        <button
            onClick={() => { setCurrentWindow('dashboard'); setIsMobileMenuOpen(false);}}
            className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/50 hover:bg-[#808080]/70 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Cancel
        </button>
      </AppNavbar>
      
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {currentWorkout?.exercises.map((exercise, exerciseIndex) => (
          <div key={exerciseIndex} className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-3 sm:mb-4">
                <div className="mb-3 md:mb-0 text-center md:text-left">
                    <h3 className="text-lg sm:text-xl font-bold text-[#F5F5F5] mb-1">{exercise.name}</h3>
                    <p className="text-sm text-[#C51D34]/90 mb-1">{exercise.muscleGroup}</p>
                    <p className="text-xs text-[#808080] capitalize">
                        Target: {exercise.visualTarget ? exercise.visualTarget.join(', ').replace(/-/g, ' ') : 'N/A'}
                    </p>
                </div>
                <div className="w-24 h-36 sm:w-28 sm:h-40 flex-shrink-0 self-center">
                  <MuscleVisualizer exerciseToDisplay={exercise.visualTarget || []} type="anterior" />
                </div>
            </div>
            
            <div className="space-y-3">
              {exercise.sets.map((set, setIndex) => (
                <div key={setIndex} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-[#2E2E30]/50 rounded-xl">
                  <span className="w-full sm:w-16 text-left sm:text-center font-semibold text-sm text-[#F5F5F5] mb-1 sm:mb-0">Set {setIndex + 1}</span>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      placeholder="Weight"
                      value={set.weight}
                      onChange={(e) => updateExerciseSet(exerciseIndex, setIndex, 'weight', e.target.value)}
                      className="flex-grow sm:w-24 px-3 py-2 bg-[#3a3a3c]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] text-sm focus:ring-[#C51D34] focus:border-[#C51D34]"
                    />
                    <span className="text-[#808080] text-sm">lbs</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      placeholder="Reps"
                      value={set.reps}
                      onChange={(e) => updateExerciseSet(exerciseIndex, setIndex, 'reps', e.target.value)}
                      className="flex-grow sm:w-24 px-3 py-2 bg-[#3a3a3c]/70 border border-[#808080]/50 rounded-lg text-[#F5F5F5] placeholder-[#808080] text-sm focus:ring-[#C51D34] focus:border-[#C51D34]"
                    />
                    <span className="text-[#808080] text-sm">reps</span>
                  </div>
                  <button
                    onClick={() => updateExerciseSet(exerciseIndex, setIndex, 'completed', !set.completed)}
                    className={`w-full sm:w-auto px-3 py-2 rounded-lg transition-colors text-sm font-medium ${ 
                      set.completed 
                        ? 'bg-[#C51D34] text-[#F5F5F5]' 
                        : 'bg-[#808080]/40 text-[#F5F5F5]/70 hover:bg-[#808080]/60'
                    }`}
                  >
                    {set.completed ? '✓ Done' : 'Mark Set'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ProgressWindow = () => {
    const [selectedProgressExercise, setSelectedProgressExercise] = useState('');
    const allTrackedExercises = Object.keys(workoutData).filter(ex => workoutData[ex] && workoutData[ex].length > 0);

    useEffect(() => {
        if (allTrackedExercises.length > 0 && !selectedProgressExercise) {
            setSelectedProgressExercise(allTrackedExercises[0]);
        }
    }, [allTrackedExercises]);

    const individualProgressData = selectedProgressExercise ? workoutData[selectedProgressExercise] : [];
    const volumeData = getTotalVolumeData();

    return (
      <div className="min-h-screen bg-[#2E2E30] text-[#F5F5F5]">
        <AppNavbar title="Progress Analytics">
           <button
              onClick={() => { setCurrentWindow('dashboard'); setIsMobileMenuOpen(false); }}
              className="w-full md:w-auto px-3 py-2 text-sm sm:px-4 sm:py-2 bg-[#808080]/50 hover:bg-[#808080]/70 text-[#F5F5F5] rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Back to Dashboard
            </button>
        </AppNavbar>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-6xl mx-auto">
          {allTrackedExercises.length > 0 ? (
            <>
            <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
                <label htmlFor="progressExerciseSelect" className="block text-sm font-medium text-[#F5F5F5]/80 mb-2">Select Exercise:</label>
                <select 
                    id="progressExerciseSelect"
                    value={selectedProgressExercise}
                    onChange={(e) => setSelectedProgressExercise(e.target.value)}
                    className="w-full bg-[#3a3a3c]/70 text-[#F5F5F5] p-2.5 text-sm rounded-md border border-[#808080]/50 focus:ring-1 focus:ring-[#C51D34] focus:border-[#C51D34] mb-4"
                >
                    {allTrackedExercises.map(ex => <option key={ex} value={ex} className="bg-[#2E2E30] text-[#F5F5F5]">{ex}</option>)}
                </select>

                {individualProgressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={individualProgressData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                        <XAxis dataKey="date" stroke="rgba(245,245,245,0.7)" tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, {month:'short', day:'numeric'})} style={{ fontSize: '0.75rem' }} />
                        <YAxis stroke="rgba(245,245,245,0.7)" style={{ fontSize: '0.75rem' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#2E2E30', 
                            border: '1px solid #808080',
                            borderRadius: '8px',
                            color: '#F5F5F5',
                            fontSize: '0.875rem'
                          }} 
                          labelStyle={{ color: '#C51D34', fontWeight: 'bold' }}
                          itemStyle={{ color: '#F5F5F5' }}
                        />
                        <Legend wrapperStyle={{color: '#F5F5F5', fontSize: '0.875rem', paddingTop: '10px'}}/>
                        <Line 
                          type="monotone" 
                          dataKey="maxWeight" 
                          stroke="#C51D34" 
                          strokeWidth={2}
                          name="Max Weight (lbs)"
                          dot={{ r: 3, fill: '#C51D34' }}
                          activeDot={{ r: 5, stroke: '#F5F5F5', fill: '#C51D34' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                ) : <p className="text-[#808080] text-sm">No data for {selectedProgressExercise}.</p>}
              </div>

              {volumeData.length > 0 && (
                <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-[#808080]/30">
                  <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-[#F5F5F5]">Total Training Volume</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={volumeData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                      <XAxis dataKey="date" stroke="rgba(245,245,245,0.7)" tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, {month:'short', day:'numeric'})} style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="rgba(245,245,245,0.7)" style={{ fontSize: '0.75rem' }}/>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#2E2E30', 
                          border: '1px solid #808080',
                          borderRadius: '8px',
                          color: '#F5F5F5',
                          fontSize: '0.875rem'
                        }} 
                        labelStyle={{ color: '#C51D34', fontWeight: 'bold' }}
                        itemStyle={{ color: '#F5F5F5' }}
                      />
                       <Legend wrapperStyle={{color: '#F5F5F5', fontSize: '0.875rem', paddingTop: '10px'}}/>
                      <Bar dataKey="volume" fill="#808080" name="Total Volume (lbs)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#3a3a3c]/80 backdrop-blur-lg rounded-2xl p-8 sm:p-12 text-center border border-[#808080]/30">
              <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-[#808080] mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2 text-[#F5F5F5]">No Progress Data Yet</h3>
              <p className="text-[#808080] mb-4 sm:mb-6 text-sm sm:text-base">Complete some workouts to see your progress charts!</p>
              <button
                onClick={() => setCurrentWindow('plan')}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-[#C51D34] hover:bg-[#B01A2E] text-[#F5F5F5] rounded-xl font-semibold text-sm sm:text-base hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Start a Workout
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCurrentWindow = () => {
    if (loadingUser) {
      return (
        <div className="min-h-screen bg-[#2E2E30] flex items-center justify-center">
          <Dumbbell className="w-16 h-16 text-[#F5F5F5] animate-pulse" />
        </div>
      );
    }

    if (!currentUser) {
      if (currentWindow === 'signup') return <SignupWindow />;
      return <LoginWindow />;
    }

    switch (currentWindow) {
      case 'setup':
        return <SetupWindow />;
      case 'dashboard':
        return <DashboardWindow />;
      case 'plan':
        return <WorkoutPlanWindow />;
      case 'workout':
        return <WorkoutWindow />;
      case 'progress':
        return <ProgressWindow />;
      default: 
        return workoutPlan && workoutPlan.length > 0 ? <DashboardWindow /> : <SetupWindow />;
    }
  };

  return renderCurrentWindow();
};

export default WorkoutTrackerApp; 