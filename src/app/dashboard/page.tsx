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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"recipes" | "planner" | "shopping">("recipes");
  const [planner, setPlanner] = useState<PlannerEntry[]>([]);
  const [plannerLoaded, setPlannerLoaded] = useState(false);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [shoppingLoaded, setShoppingLoaded] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showUpload, setShowUpload] = useState(true);

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

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!preview) {
      toast.error("Please upload a food image first");
      return;
    }
    setLoading(true);
    setRecipes([]);
    setShowUpload(false);
    try {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate recipes");
      }
      const data = await res.json();
      setRecipes(data);
      toast.success("Recipes generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setShowUpload(true);
    } finally {
      setLoading(false);
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
    setPreview(null);
    setRecipes([]);
    setShowUpload(true);
    setSelectedRecipe(null);
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
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">RecipeAI</h1>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === "recipes" && recipes.length > 0) && (
              <button
                onClick={startNewUpload}
                className="flex items-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-600 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Photo
              </button>
            )}
            <span className="text-sm text-gray-600 hidden sm:block">{session.user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto w-full px-6 pt-6">
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 w-fit">
          {[
            { id: "recipes" as const, label: "Recipes", action: () => {} },
            { id: "planner" as const, label: "Weekly Planner", action: loadPlanner },
            { id: "shopping" as const, label: "Shopping Cart", action: loadShopping },
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
      <main className="max-w-6xl mx-auto w-full px-6 py-6 flex-1">
        {/* RECIPES TAB */}
        {activeTab === "recipes" && (
          <div>
            {showUpload && !loading && recipes.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Food Photo</h2>
                <p className="text-gray-500 mb-6">Take a photo of ingredients or food items to get personalized recipe recommendations.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all"
                  >
                    {preview ? (
                      <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg object-cover" />
                    ) : (
                      <div>
                        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-gray-500 font-medium mb-1">Click to upload a food image</p>
                        <p className="text-sm text-gray-400">JPG, PNG, WebP supported</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </div>
                  <div className="flex flex-col gap-2 justify-end">
                    <button
                      onClick={handleGenerate}
                      disabled={loading || !preview}
                      className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Get Recipes
                    </button>
                    {preview && (
                      <button
                        onClick={() => { setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Analyzing your image with AI...</p>
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
              </div>
            )}
          </div>
        )}

        {/* PLANNER TAB */}
        {activeTab === "planner" && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Meal Planner</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
                <div className="px-4 py-3 font-medium text-sm text-gray-600">Day</div>
                <div className="px-4 py-3 font-medium text-sm text-gray-600">Breakfast</div>
                <div className="px-4 py-3 font-medium text-sm text-gray-600">Lunch</div>
                <div className="px-4 py-3 font-medium text-sm text-gray-600">Dinner</div>
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
            <p className="text-sm text-gray-500 mt-4">
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
      </main>
    </div>
  );
}

function RecipeCardThumbnail({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const imageUrl = recipe.aiImageUrl || recipe.imageUrl;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      {imageUrl && (
        <div className="relative h-48 w-full">
          <img
            src={imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
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
            {recipe.time}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
            {recipe.calories} kcal
          </span>
        </div>
      </div>
    </div>
  );
}
