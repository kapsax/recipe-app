"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

const CUISINE_OPTIONS = [
  { id: "north-indian", label: "North Indian", emoji: "🍛" },
  { id: "south-indian", label: "South Indian", emoji: "🥘" },
  { id: "continental", label: "Continental", emoji: "🍝" },
  { id: "asian", label: "Asian", emoji: "🍜" },
  { id: "italian", label: "Italian", emoji: "🍕" },
  { id: "mexican", label: "Mexican", emoji: "🌮" },
  { id: "mediterranean", label: "Mediterranean", emoji: "🥙" },
  { id: "chinese", label: "Chinese", emoji: "🥡" },
  { id: "japanese", label: "Japanese", emoji: "🍣" },
  { id: "thai", label: "Thai", emoji: "🍲" },
  { id: "middle-eastern", label: "Middle Eastern", emoji: "🧆" },
  { id: "american", label: "American", emoji: "🍔" },
];

const DIET_OPTIONS = [
  { id: "veg", label: "Vegetarian", emoji: "🥬", desc: "Only vegetarian recipes" },
  { id: "nonveg", label: "Non-Vegetarian", emoji: "🍗", desc: "Only non-vegetarian recipes" },
  { id: "both", label: "Both", emoji: "🍽️", desc: "Show all recipes" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [dietType, setDietType] = useState("both");
  const [onDiet, setOnDiet] = useState(false);
  const [loading, setLoading] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  const toggleCuisine = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      toast.error("Please select at least one cuisine preference");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: selected, dietType, onDiet }),
      });

      if (res.ok) {
        toast.success("Preferences saved!");
        router.push("/dashboard");
      } else {
        toast.error("Failed to save preferences");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, {session.user.name?.split(" ")[0]}!
        </h1>
        <p className="text-gray-600 mb-8">
          Select your preferences so we can recommend the best recipes for you.
        </p>

        {/* Diet Type */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Diet Type</h3>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {DIET_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setDietType(option.id)}
              className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                dietType === option.id
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-medium text-sm">{option.label}</span>
              <span className="text-xs text-gray-400">{option.desc}</span>
            </button>
          ))}
        </div>

        {/* Diet Mode Toggle */}
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥗</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">I am on a diet</p>
              <p className="text-xs text-gray-500">Suggest low-calorie, healthier recipe options</p>
            </div>
          </div>
          <button
            onClick={() => setOnDiet(!onDiet)}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${onDiet ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${onDiet ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Cuisines */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Cuisine Preferences</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {CUISINE_OPTIONS.map((cuisine) => (
            <button
              key={cuisine.id}
              onClick={() => toggleCuisine(cuisine.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                selected.includes(cuisine.id)
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-xl">{cuisine.emoji}</span>
              <span className="font-medium text-sm">{cuisine.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || selected.length === 0}
          className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Saving..." : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
