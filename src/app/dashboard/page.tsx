"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import RecipeDetail from "@/components/RecipeDetail";

interface Recipe {
  id: string;
  title: string;
  titleHindi?: string | null;
  description: string;
  descriptionHindi?: string | null;
  time: string;
  calories: number;
  isVeg: boolean;
  ingredients: string;
  steps: string;
  stepsHindi?: string | null;
  missingItems?: string | null;
  allergies?: string | null;
  imageUrl?: string | null;
  aiImageUrl?: string | null;
  uploadBatchId?: string | null;
  createdAt: string;
}

interface PlannerEntry {
  id: string;
  day: string;
  mealType: string;
  recipe: Recipe;
}

interface ShoppingItem {
  id: string;
  name: string;
  recipeId: string | null;
  checked: boolean;
}

interface HistoryGroup {
  batchId: string;
  uploadImage: string | null;
  recipes: Recipe[];
  date: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"recipes" | "planner" | "shopping" | "history">("recipes");
  const [planner, setPlanner] = useState<PlannerEntry[]>([]);
  const [plannerLoaded, setPlannerLoaded] = useState(false);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [shoppingLoaded, setShoppingLoaded] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showUpload, setShowUpload] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [history, setHistory] = useState<HistoryGroup[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const loadPlanner = useCallback(async () => {
    if (plannerLoaded) return;
    try {
      const res = await fetch("/api/planner");
      if (res.ok) {
        const data = await res.json();
        setPlanner(data);
        setPlannerLoaded(true);
      }
    } catch {
      toast.error("Failed to load planner");
    }
  }, [plannerLoaded]);

  const loadShopping = useCallback(async () => {
    if (shoppingLoaded) return;
    try {
      const res = await fetch("/api/shopping");
      if (res.ok) {
        const data = await res.json();
        setShopping(data);
        setShoppingLoaded(true);
      }
    } catch {
      toast.error("Failed to load shopping list");
    }
  }, [shoppingLoaded]);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const res = await fetch("/api/recipes");
      if (res.ok) {
        const allRecipes: Recipe[] = await res.json();
        const groups: Record<string, HistoryGroup> = {};
        allRecipes.forEach((recipe) => {
          const key = recipe.uploadBatchId || recipe.id;
          if (!groups[key]) {
            groups[key] = {
              batchId: key,
              uploadImage: recipe.imageUrl ?? null,
              recipes: [],
              date: recipe.createdAt,
            };
          }
          groups[key].recipes.push(recipe);
        });
        setHistory(Object.values(groups));
        setHistoryLoaded(true);
      }
    } catch {
      toast.error("Failed to load history");
    }
  }, [historyLoaded]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  const compressImage = (file: File, maxDim = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim;
              width = maxDim;
            } else {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image file`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;
    const compressed = await Promise.all(validFiles.map((f) => compressImage(f)));
    setPreviews((prev) => [...prev, ...compressed]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePreview = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const callGenerateAPI = async (fetchBody: object): Promise<{ recipes: Recipe[]; uploadBatchId: string }> => {
    const res = await fetch("/api/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fetchBody),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server error. Please try again.");
    }
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to generate recipes");
    }
    if (!data.recipes || !Array.isArray(data.recipes)) {
      throw new Error("Invalid response from server");
    }
    // Ensure all recipes have required fields
    data.recipes = data.recipes.filter((r: Recipe) => r && r.title && r.description);
    return data;
  };

  const handleGenerate = async () => {
    if (previews.length === 0) {
      toast.error("Please upload at least one food image");
      return;
    }
    setLoading(true);
    setRecipes([]);
    setShowUpload(false);
    setCurrentBatchId(null);
    try {
      const data = await callGenerateAPI({ images: previews });
      setRecipes(data.recipes);
      setCurrentBatchId(data.uploadBatchId);
      setHistoryLoaded(false);
      toast.success("Recipes generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setShowUpload(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    if (previews.length === 0) return;
    setLoadingMore(true);
    try {
      const excludeTitles = recipes.map((r) => r.title);
      const data = await callGenerateAPI({
        images: previews,
        excludeTitles,
        uploadBatchId: currentBatchId,
      });
      setRecipes((prev) => [...prev, ...data.recipes]);
      setHistoryLoaded(false);
      toast.success("More recipes generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingMore(false);
    }
  };

  const addToPlanner = async (recipeId: string, day: string, mealType: string) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, day, mealType }),
      });
      if (res.ok) {
        const entry = await res.json();
        setPlanner((prev) => {
          const filtered = prev.filter((p) => !(p.day === day && p.mealType === mealType));
          return [...filtered, entry];
        });
        setPlannerLoaded(false);
        toast.success(`Added to ${day} - ${mealType}`);
      }
    } catch {
      toast.error("Failed to add to planner");
    }
  };

  const removeFromPlanner = async (day: string, mealType: string) => {
    try {
      await fetch("/api/planner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, mealType }),
      });
      setPlanner((prev) => prev.filter((p) => !(p.day === day && p.mealType === mealType)));
      toast.success("Removed from planner");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const addToShopping = async (items: string[], recipeId?: string) => {
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, recipeId }),
      });
      if (res.ok) {
        const data = await res.json();
        setShopping((prev) => [...data, ...prev]);
        toast.success("Added to shopping list!");
      }
    } catch {
      toast.error("Failed to add items");
    }
  };

  const toggleShoppingItem = async (id: string, checked: boolean) => {
    try {
      await fetch("/api/shopping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checked }),
      });
      setShopping((prev) => prev.map((i) => (i.id === id ? { ...i, checked } : i)));
    } catch {
      toast.error("Failed to update");
    }
  };

  const clearCheckedItems = async () => {
    try {
      await fetch("/api/shopping", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearChecked: true }),
      });
      setShopping((prev) => prev.filter((i) => !i.checked));
      toast.success("Cleared purchased items");
    } catch {
      toast.error("Failed to clear");
    }
  };

  const getPlannerEntry = (day: string, mealType: string) =>
    planner.find((p) => p.day === day && p.mealType === mealType);

  const startNewUpload = () => {
    setPreviews([]);
    setRecipes([]);
    setShowUpload(true);
    setSelectedRecipe(null);
    setCurrentBatchId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Recipe detail view
  if (selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        onBack={() => setSelectedRecipe(null)}
        onBackToRecommendations={() => {
          setSelectedRecipe(null);
          setActiveTab("recipes");
        }}
        onAddToPlanner={addToPlanner}
        onAddToShopping={addToShopping}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">RecipeAI</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {(activeTab === "recipes" && recipes.length > 0) && (
              <button
                onClick={startNewUpload}
                className="flex items-center gap-1.5 sm:gap-2 bg-orange-500 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-600 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Photo</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {session.user.image ? (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
                    {session.user.name?.[0] || session.user.email?.[0] || "U"}
                  </div>
                )}
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                    </div>
                    <button
                      onClick={() => { setShowProfileMenu(false); router.push("/preferences"); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Preferences
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4 sm:pt-6 overflow-x-auto">
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 w-fit min-w-fit">
          {[
            { id: "recipes" as const, label: "Recipes", action: () => {} },
            { id: "planner" as const, label: "Weekly Planner", action: loadPlanner },
            { id: "shopping" as const, label: "Shopping Cart", action: loadShopping },
            { id: "history" as const, label: "History", action: loadHistory },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); tab.action(); }}
              className={`px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {tab.id === "shopping" && shopping.filter((s) => !s.checked).length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {shopping.filter((s) => !s.checked).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex-1">
        {/* RECIPES TAB */}
        {activeTab === "recipes" && (
          <div>
            {showUpload && !loading && recipes.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8 mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Upload Food Photos</h2>
                <p className="text-gray-500 text-sm sm:text-base mb-4 sm:mb-6">Upload one or more photos of ingredients or food items to get personalized recipe recommendations.</p>
                <div className="flex flex-col gap-4">
                  {previews.length > 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 sm:p-8">
                      <div className="flex flex-wrap gap-3 justify-center">
                        {previews.map((p, i) => (
                          <div key={i} className="relative">
                            <img src={p} alt={`Preview ${i + 1}`} className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg" />
                            <button
                              onClick={() => removePreview(i)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer shadow-md"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-center mt-4">
                        <button
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.capture = "environment";
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files;
                              if (files) processFiles(files);
                            };
                            input.click();
                          }}
                          className="flex items-center gap-1.5 text-sm text-orange-600 border border-orange-300 px-3 py-2 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                          Take Photo
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add More
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Take Photo button - opens camera on mobile */}
                      <button
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.capture = "environment";
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files) processFiles(files);
                          };
                          input.click();
                        }}
                        className="border-2 border-dashed border-orange-300 rounded-xl p-6 sm:p-10 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all bg-orange-50/30"
                      >
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-orange-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-orange-600 font-semibold mb-1">Take a Photo</p>
                        <p className="text-xs text-orange-400">Opens your camera</p>
                      </button>
                      {/* Upload from gallery */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-10 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all"
                      >
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500 font-semibold mb-1">Upload from Gallery</p>
                        <p className="text-xs text-gray-400">Select multiple images</p>
                      </button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                  <div className="flex gap-2 justify-end">
                    {previews.length > 0 && (
                      <button
                        onClick={() => { setPreviews([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer px-4 py-2"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={loading || previews.length === 0}
                      className="bg-orange-500 text-white font-semibold px-5 sm:px-6 py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors text-sm sm:text-base"
                    >
                      Get Recipes {previews.length > 1 ? `(${previews.length} images)` : ""}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Analyzing your {previews.length > 1 ? "images" : "image"} with AI...</p>
                  <p className="text-sm text-gray-400 mt-1">This may take 10-15 seconds</p>
                </div>
              </div>
            )}

            {recipes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Recommended Recipes</h2>
                  <button
                    onClick={startNewUpload}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try another photo
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recipes.map((recipe) => (
                    <RecipeCardThumbnail
                      key={recipe.id}
                      recipe={recipe}
                      onClick={() => setSelectedRecipe(recipe)}
                    />
                  ))}
                </div>
                {/* Generate More Button */}
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleGenerateMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-white border-2 border-orange-500 text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                        Generating more...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Generate More Recipes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PLANNER TAB */}
        {activeTab === "planner" && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Meal Planner</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <div className="min-w-[500px]">
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
                <div className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm text-gray-600">Day</div>
                <div className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm text-gray-600">Breakfast</div>
                <div className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm text-gray-600">Lunch</div>
                <div className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm text-gray-600">Dinner</div>
              </div>
              {DAYS.map((day) => (
                <div key={day} className="grid grid-cols-4 border-b border-gray-100 last:border-0">
                  <div className="px-4 py-4 font-medium text-sm text-gray-800">{day}</div>
                  {MEAL_TYPES.map((mealType) => {
                    const entry = getPlannerEntry(day, mealType);
                    return (
                      <div key={mealType} className="px-3 py-3">
                        {entry ? (
                          <div
                            className="bg-orange-50 border border-orange-200 rounded-lg p-2 group relative cursor-pointer hover:shadow-sm transition-shadow"
                            onClick={() => setSelectedRecipe(entry.recipe)}
                          >
                            {entry.recipe.aiImageUrl && (
                              <img src={entry.recipe.aiImageUrl} alt="" className="w-full h-12 object-cover rounded mb-1" />
                            )}
                            <p className="text-xs font-medium text-gray-800 truncate">{entry.recipe.title}</p>
                            <p className="text-xs text-gray-500">{entry.recipe.calories} kcal</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFromPlanner(day, mealType); }}
                              className="absolute top-1 right-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="border border-dashed border-gray-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400">Empty</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-4">
              Click on any recipe card to view details and add to your planner.
            </p>
          </div>
        )}

        {/* SHOPPING TAB */}
        {activeTab === "shopping" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Shopping Cart</h2>
              {shopping.some((s) => s.checked) && (
                <button
                  onClick={clearCheckedItems}
                  className="text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer"
                >
                  Clear purchased items
                </button>
              )}
            </div>
            {shopping.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-gray-500 font-medium">Your shopping cart is empty</p>
                <p className="text-sm text-gray-400 mt-1">Missing items from recipes will appear here when you add them.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {shopping.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => toggleShoppingItem(item.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className={`flex-1 text-sm ${item.checked ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {item.name}
                    </span>
                    <button
                      onClick={async () => {
                        await fetch("/api/shopping", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: item.id }),
                        });
                        setShopping((prev) => prev.filter((i) => i.id !== item.id));
                      }}
                      className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recipe History</h2>
            {history.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium">No recipe history yet</p>
                <p className="text-sm text-gray-400 mt-1">Upload food photos to generate recipes and they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((group) => (
                  <div key={group.batchId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
                      {group.uploadImage ? (
                        <img
                          src={group.uploadImage}
                          alt="Uploaded"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {group.recipes.length} recipe{group.recipes.length !== 1 ? "s" : ""} generated
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(group.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.recipes.map((recipe) => (
                          <div
                            key={recipe.id}
                            onClick={() => setSelectedRecipe(recipe)}
                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <RecipeImageSmall recipe={recipe} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{recipe.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">{recipe.time}</span>
                                <span className="text-xs text-gray-500">{recipe.calories} kcal</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${recipe.isVeg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {recipe.isVeg ? "VEG" : "NON-VEG"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RecipeImageSmall({ recipe }: { recipe: Recipe }) {
  const imageUrl = recipe.aiImageUrl || recipe.imageUrl;
  const [error, setError] = useState(false);
  if (!imageUrl || error) {
    return (
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  return <img src={imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" onError={() => setError(true)} />;
}

function RecipeCardThumbnail({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const imageUrl = recipe.aiImageUrl || recipe.imageUrl;
  const [imgError, setImgError] = useState(false);
  const showImage = imageUrl && !imgError;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      {showImage ? (
        <div className="relative h-48 w-full">
          <img
            src={imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${recipe.isVeg ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
              {recipe.isVeg ? "VEG" : "NON-VEG"}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative h-48 w-full bg-gray-100 flex flex-col items-center justify-center">
          <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-400 font-medium">Image not available</p>
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${recipe.isVeg ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
              {recipe.isVeg ? "VEG" : "NON-VEG"}
            </span>
          </div>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{recipe.title}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{recipe.description}</p>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {recipe.time || "N/A"}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
            {recipe.calories || 0} kcal
          </span>
        </div>
      </div>
    </div>
  );
}
