"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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

export default function PreferencesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [dietType, setDietType] = useState("both");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      const user = session.user as { preferences?: string | null; dietType?: string };
      if (user.preferences) {
        try { setSelected(JSON.parse(user.preferences)); } catch {}
      }
      if (user.dietType) setDietType(user.dietType);
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  const toggleCuisine = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      toast.error("Please select at least one cuisine preference");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: selected, dietType }),
      });

      if (res.ok) {
        toast.success("Preferences updated!");
        router.push("/dashboard");
      } else {
        toast.error("Failed to update preferences");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-6 min-h-screen">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
            <p className="text-gray-500 text-sm">Update your preferences to get better recipe recommendations.</p>
          </div>
        </div>

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

        {/* Cuisines */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Cuisine Preferences</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {CUISINE_OPTIONS.map((cuisine) => (
            <button
              key={cuisine.id}
              onClick={() => toggleCuisine(cuisine.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
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

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || selected.length === 0}
            className="flex-1 bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {loading ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
