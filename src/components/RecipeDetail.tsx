"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import RecipeChat from "./RecipeChat";

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

export default function RecipeDetail({
  recipe,
  onBack,
  onBackToRecommendations,
  onAddToPlanner,
  onAddToShopping,
}: {
  recipe: Recipe;
  onBack: () => void;
  onBackToRecommendations: () => void;
  onAddToPlanner: (recipeId: string, day: string, mealType: string) => void;
  onAddToShopping: (items: string[], recipeId?: string) => void;
}) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [showPlanner, setShowPlanner] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const ingredients = recipe.ingredients ? (JSON.parse(recipe.ingredients) as string[]) : [];
  const steps = recipe.steps ? (JSON.parse(recipe.steps) as string[]) : [];
  const stepsHindi = recipe.stepsHindi ? (JSON.parse(recipe.stepsHindi) as string[]) : [];
  const missingItems = recipe.missingItems ? (JSON.parse(recipe.missingItems) as string[]) : [];
  const allergies = recipe.allergies ? (JSON.parse(recipe.allergies) as string[]) : [];

  const [imgError, setImgError] = useState(false);

  const displayTitle = lang === "hi" && recipe.titleHindi ? recipe.titleHindi : recipe.title;
  const displayDesc = lang === "hi" && recipe.descriptionHindi ? recipe.descriptionHindi : recipe.description;
  const displaySteps = lang === "hi" && stepsHindi.length > 0 ? stepsHindi : steps;
  const rawImageUrl = recipe.aiImageUrl || recipe.imageUrl;
  const imageUrl = rawImageUrl && !imgError ? rawImageUrl : null;

  const handleShare = async () => {
    if (!shareEmail) { toast.error("Enter an email"); return; }
    setSharing(true);
    try {
      const res = await fetch("/api/recipes/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id, email: shareEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.fallback && data.mailto) {
          window.open(data.mailto, "_blank");
          toast.success("Opening email client...");
        } else {
          toast.success(`Recipe shared with ${shareEmail}!`);
        }
        setShareEmail("");
        setShowShare(false);
      } else {
        toast.error(data.error || "Failed to share");
      }
    } catch { toast.error("Failed to share"); }
    finally { setSharing(false); }
  };

  const handleSavePDF = () => {
    const allergyHtml = allergies.length > 0
      ? `<h3 style="color:#dc2626;margin-top:24px;">Allergy Warnings</h3><div style="display:flex;gap:8px;flex-wrap:wrap;">${allergies.map(a => `<span style="background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">${a.toUpperCase()}</span>`).join("")}</div>`
      : "";
    const missingHtml = missingItems.length > 0
      ? `<h3 style="color:#d97706;margin-top:24px;">Missing Items</h3><ul>${missingItems.map(i => `<li>${i}</li>`).join("")}</ul>`
      : "";
    const content = `<html><head><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto}h1{color:#ea580c}img{width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:20px}.meta{display:flex;gap:20px;margin:16px 0;color:#666}.badge{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold}.veg{background:#dcfce7;color:#166534}.nonveg{background:#fee2e2;color:#991b1b}h3{margin-top:24px}li{margin:8px 0;line-height:1.6}</style></head><body>${imageUrl ? `<img src="${imageUrl}" alt="${recipe.title}"/>` : ""}<h1>${recipe.title}</h1><p>${recipe.description}</p><div class="meta"><span>Time: ${recipe.time}</span><span>Calories: ${recipe.calories} kcal</span><span class="badge ${recipe.isVeg ? "veg" : "nonveg"}">${recipe.isVeg ? "VEG" : "NON-VEG"}</span></div>${allergyHtml}<h3>Ingredients</h3><ul>${ingredients.map(i => `<li>${i}</li>`).join("")}</ul>${missingHtml}<h3>Steps</h3><ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol></body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.onload = () => w.print();
  };

  const handleAddToPlanner = (day: string, meal: string) => {
    onAddToPlanner(recipe.id, day, meal.toLowerCase());
    setShowPlanner(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 cursor-pointer transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-sm sm:text-base">Back</span>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setLang("en")}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md cursor-pointer transition-colors ${lang === "en" ? "bg-white shadow-sm font-semibold text-gray-900" : "text-gray-500"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("hi")}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md cursor-pointer transition-colors ${lang === "hi" ? "bg-white shadow-sm font-semibold text-gray-900" : "text-gray-500"}`}
              >
                HI
              </button>
            </div>
            <button
              onClick={onBackToRecommendations}
              className="text-xs sm:text-sm text-orange-600 hover:text-orange-700 font-medium cursor-pointer"
            >
              All Recipes
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Hero Image */}
        {imageUrl && (
          <div className="relative rounded-2xl overflow-hidden mb-8 shadow-lg">
            <img src={imageUrl} alt={recipe.title} className="w-full h-72 md:h-96 object-cover" onError={() => setImgError(true)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6">
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${recipe.isVeg ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                {recipe.isVeg ? "VEGETARIAN" : "NON-VEGETARIAN"}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{displayTitle}</h1>
            </div>
          </div>
        )}

        {!imageUrl && (
          <div className="relative rounded-2xl overflow-hidden mb-8 bg-gray-100">
            <div className="w-full h-48 flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 font-medium">Image not available</p>
            </div>
            <div className="absolute bottom-4 left-6 right-6">
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-2 ${recipe.isVeg ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                {recipe.isVeg ? "VEGETARIAN" : "NON-VEGETARIAN"}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{displayTitle}</h1>
            </div>
          </div>
        )}

        {/* Meta Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <svg className="w-6 h-6 mx-auto text-orange-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-bold text-gray-900">{recipe.time}</p>
            <p className="text-xs text-gray-500">Cook Time</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <svg className="w-6 h-6 mx-auto text-orange-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
            <p className="text-lg font-bold text-gray-900">{recipe.calories}</p>
            <p className="text-xs text-gray-500">Calories</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <svg className="w-6 h-6 mx-auto text-orange-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-bold text-gray-900">{ingredients.length}</p>
            <p className="text-xs text-gray-500">Ingredients</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <svg className="w-6 h-6 mx-auto text-orange-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <p className="text-lg font-bold text-gray-900">{steps.length}</p>
            <p className="text-xs text-gray-500">Steps</p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p className="text-gray-700 leading-relaxed text-lg">{displayDesc}</p>
        </div>

        {/* Allergies */}
        {allergies.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Allergy Warnings
            </h3>
            <div className="flex flex-wrap gap-2">
              {allergies.map((allergy, i) => (
                <span key={i} className="bg-red-100 text-red-700 font-semibold text-sm px-3 py-1 rounded-full border border-red-200">
                  {allergy.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingredients</h3>
          <ul className="space-y-3">
            {ingredients.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Missing Items */}
        {missingItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Missing Items
              </h3>
              <button
                onClick={() => onAddToShopping(missingItems, recipe.id)}
                className="flex items-center gap-1 bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 cursor-pointer transition-colors w-fit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to Shopping Cart
              </button>
            </div>
            <ul className="space-y-2">
              {missingItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-amber-800">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {lang === "hi" ? "बनाने की विधि" : "Instructions"}
          </h3>
          <ol className="space-y-4">
            {displaySteps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-gray-700 leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowPlanner(!showPlanner)}
              className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-lg font-medium hover:bg-green-100 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add to Weekly Planner
            </button>
            <button
              onClick={() => setShowShare(!showShare)}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-lg font-medium hover:bg-blue-100 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share via Email
            </button>
            <button
              onClick={handleSavePDF}
              className="flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-lg font-medium hover:bg-purple-100 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Save as PDF
            </button>
          </div>

          {/* Planner Selector */}
          {showPlanner && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Select day and meal:</p>
              {/* Mobile: list layout */}
              <div className="sm:hidden space-y-2">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-10">{day.slice(0, 3)}</span>
                    <div className="flex gap-1.5 flex-1">
                      {MEAL_TYPES.map((meal) => (
                        <button
                          key={meal}
                          onClick={() => handleAddToPlanner(day, meal)}
                          className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-2 text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 cursor-pointer transition-colors"
                        >
                          {meal}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: grid layout */}
              <div className="hidden sm:grid grid-cols-7 gap-2">
                {DAYS.map((day) => (
                  <div key={day} className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 text-center">{day.slice(0, 3)}</p>
                    {MEAL_TYPES.map((meal) => (
                      <button
                        key={meal}
                        onClick={() => handleAddToPlanner(day, meal)}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-1 py-1.5 text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 cursor-pointer transition-colors"
                      >
                        {meal.slice(0, 1)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 hidden sm:block">B = Breakfast, L = Lunch, D = Dinner</p>
            </div>
          )}

          {/* Share */}
          {showShare && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Enter email address..."
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={handleShare}
                disabled={sharing}
                className="bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
              >
                {sharing ? "Sending..." : "Send"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer flex items-center gap-2 z-40 group"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="font-semibold text-sm">Ask Chef AI</span>
        </button>
      )}

      {/* Chat Panel */}
      <RecipeChat
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
