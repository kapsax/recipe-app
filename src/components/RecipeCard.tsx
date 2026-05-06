"use client";

import { useState } from "react";
import toast from "react-hot-toast";

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
  createdAt: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"] as const;

export default function RecipeCard({ recipe, onAddToPlanner }: { recipe: Recipe; onAddToPlanner?: (recipeId: string, day: string, mealType: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");

  const ingredients = JSON.parse(recipe.ingredients) as string[];
  const steps = JSON.parse(recipe.steps) as string[];
  const stepsHindi = recipe.stepsHindi ? JSON.parse(recipe.stepsHindi) as string[] : [];
  const missingItems = recipe.missingItems ? JSON.parse(recipe.missingItems) as string[] : [];
  const allergies = recipe.allergies ? JSON.parse(recipe.allergies) as string[] : [];

  const displayTitle = lang === "hi" && recipe.titleHindi ? recipe.titleHindi : recipe.title;
  const displayDesc = lang === "hi" && recipe.descriptionHindi ? recipe.descriptionHindi : recipe.description;
  const displaySteps = lang === "hi" && stepsHindi.length > 0 ? stepsHindi : steps;

  const handleShare = async () => {
    if (!shareEmail) {
      toast.error("Please enter an email");
      return;
    }
    setSharing(true);
    try {
      const res = await fetch("/api/recipes/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id, email: shareEmail }),
      });
      if (res.ok) {
        toast.success(`Recipe shared with ${shareEmail}`);
        setShareEmail("");
        setShowShare(false);
      } else {
        toast.error("Failed to share recipe");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSharing(false);
    }
  };

  const handleSavePDF = () => {
    const allergyHtml = allergies.length > 0
      ? `<h3 style="color:#dc2626;">Allergy Warnings</h3><div style="display:flex;gap:8px;flex-wrap:wrap;">${allergies.map(a => `<span style="background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">${a.toUpperCase()}</span>`).join("")}</div>`
      : "";
    const missingHtml = missingItems.length > 0
      ? `<h3>Missing Items (need to buy)</h3><ul>${missingItems.map(i => `<li style="color:#d97706;">${i}</li>`).join("")}</ul>`
      : "";

    const content = `
      <html>
        <head><style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #ea580c; }
          .meta { display: flex; gap: 20px; margin: 16px 0; color: #666; }
          .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .veg { background: #dcfce7; color: #166534; }
          .nonveg { background: #fee2e2; color: #991b1b; }
          h3 { margin-top: 24px; }
          li { margin: 6px 0; line-height: 1.5; }
        </style></head>
        <body>
          <h1>${recipe.title}</h1>
          <p>${recipe.description}</p>
          <div class="meta">
            <span>Time: ${recipe.time}</span>
            <span>Calories: ${recipe.calories} kcal</span>
            <span class="badge ${recipe.isVeg ? "veg" : "nonveg"}">
              ${recipe.isVeg ? "VEG" : "NON-VEG"}
            </span>
          </div>
          ${allergyHtml}
          <h3>Ingredients</h3>
          <ul>${ingredients.map(i => `<li>${i}</li>`).join("")}</ul>
          ${missingHtml}
          <h3>Steps</h3>
          <ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol>
        </body>
      </html>
    `;

    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (printWindow) {
      printWindow.onload = () => printWindow.print();
    }
  };

  const handleAddToPlanner = (day: string, mealType: string) => {
    if (onAddToPlanner) {
      onAddToPlanner(recipe.id, day, mealType);
    }
    setShowPlanner(false);
    toast.success(`Added to ${day} ${mealType}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      {/* Language Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setLang("en")}
            className={`text-xs px-2 py-1 rounded-md cursor-pointer transition-colors ${lang === "en" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500"}`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("hi")}
            className={`text-xs px-2 py-1 rounded-md cursor-pointer transition-colors ${lang === "hi" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500"}`}
          >
            HI
          </button>
        </div>
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full ${
            recipe.isVeg
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {recipe.isVeg ? "VEG" : "NON-VEG"}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 text-base mb-1">{displayTitle}</h3>
      <p className="text-sm text-gray-600 mb-3">{displayDesc}</p>

      {/* Meta */}
      <div className="flex gap-4 text-sm text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <ClockIcon /> {recipe.time}
        </span>
        <span className="flex items-center gap-1">
          <FireIcon /> {recipe.calories} kcal
        </span>
      </div>

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {allergies.map((allergy, i) => (
            <span
              key={i}
              className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-200"
            >
              ⚠ {allergy}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 pt-3 mt-1 space-y-4">
          <div>
            <h4 className="font-medium text-sm text-gray-800 mb-2">Ingredients</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {ingredients.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Missing Items */}
          {missingItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h4 className="font-medium text-sm text-amber-800 mb-2 flex items-center gap-1">
                <ShoppingIcon /> Missing Items (need to buy)
              </h4>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {missingItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-medium text-sm text-gray-800 mb-2">
              {lang === "hi" ? "ब���ाने की विधि" : "Steps"}
            </h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
              {displaySteps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto pt-3 border-t border-gray-100 flex flex-wrap gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-orange-600 hover:text-orange-700 font-medium cursor-pointer"
        >
          {expanded ? "Show less" : "View details"}
        </button>
        <button
          onClick={() => setShowShare(!showShare)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
        >
          Share
        </button>
        <button
          onClick={handleSavePDF}
          className="text-xs text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
        >
          Save as PDF
        </button>
        {onAddToPlanner && (
          <button
            onClick={() => setShowPlanner(!showPlanner)}
            className="text-xs text-green-600 hover:text-green-700 font-medium cursor-pointer"
          >
            + Add to Planner
          </button>
        )}
      </div>

      {/* Share Input */}
      {showShare && (
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            placeholder="Enter email..."
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button
            onClick={handleShare}
            disabled={sharing}
            className="text-sm bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {sharing ? "..." : "Send"}
          </button>
        </div>
      )}

      {/* Planner Selector */}
      {showPlanner && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Select day & meal:</p>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {MEAL_TYPES.map((meal) => (
              <button
                key={meal}
                className="text-xs bg-white border border-gray-200 rounded px-2 py-1 font-medium text-gray-700 hover:bg-orange-50 hover:border-orange-300 cursor-pointer"
                onClick={() => {}}
                id={`meal-${meal}`}
              >
                {meal}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {DAYS.map((day) => (
              <PlannerDayButton key={day} day={day} onSelect={handleAddToPlanner} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlannerDayButton({ day, onSelect }: { day: string; onSelect: (day: string, mealType: string) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);

  if (selectedMeal) {
    return (
      <div className="col-span-4 flex gap-1 items-center bg-orange-50 rounded p-1">
        <span className="text-xs font-medium text-gray-700 mr-1">{day}:</span>
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal}
            onClick={() => onSelect(day, meal.toLowerCase())}
            className="text-xs bg-orange-500 text-white rounded px-2 py-1 hover:bg-orange-600 cursor-pointer"
          >
            {meal}
          </button>
        ))}
        <button
          onClick={() => setSelectedMeal(null)}
          className="text-xs text-gray-400 ml-auto cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setSelectedMeal(day)}
      className="text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-600 hover:bg-orange-50 hover:border-orange-300 cursor-pointer"
    >
      {day.slice(0, 3)}
    </button>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  );
}

function ShoppingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

