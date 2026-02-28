"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, BookOpen, Video, Phone, FileText, Bookmark, Share2, ExternalLink, Wrench, Heart } from "lucide-react"

const categories = [
  { id: "all", label: "All Resources" },
  { id: "crisis", label: "Crisis & Emergency" },
  { id: "mental-health", label: "Mental Health 101" },
  { id: "academic", label: "Academic Stress" },
  { id: "sleep", label: "Sleep & Rest" },
  { id: "physical", label: "Physical Wellness" },
  { id: "anxiety", label: "Anxiety & Worry" },
  { id: "depression", label: "Depression" },
  { id: "lgbtq", label: "LGBTQ+ Resources" },
  { id: "international", label: "International Students" },
  { id: "mindfulness", label: "Mindfulness" },
  { id: "umd", label: "UMD Services" },
]

const featuredResource = {
  title: "Managing Exam Anxiety: A Practical Guide for UMD Students",
  description: "Learn evidence-based techniques to manage test anxiety, from breathing exercises to cognitive reframing. Developed with UMD Counseling Center staff.",
  source: "UMD Counseling Center",
  readTime: "8 min read",
  type: "Article",
  category: "anxiety",
}

const resources = [
  { id: 1, type: "Article", title: "Understanding Anxiety: What It Is and How to Cope", source: "NIMH", readTime: "5 min", tags: ["Anxiety", "Self-Help"], category: "anxiety", saved: false },
  { id: 2, type: "Video", title: "5-Minute Guided Meditation for Students", source: "UMD Wellness", readTime: "5 min", tags: ["Mindfulness", "Video"], category: "mindfulness", saved: false },
  { id: 3, type: "Tool", title: "4-7-8 Breathing Exercise", source: "Huddle", readTime: "Interactive", tags: ["Breathing", "Calm"], category: "mindfulness", saved: true },
  { id: 4, type: "Article", title: "Sleep Hygiene Tips for College Students", source: "NIH", readTime: "7 min", tags: ["Sleep", "Wellness"], category: "sleep", saved: false },
  { id: 5, type: "Hotline", title: "988 Suicide & Crisis Lifeline", source: "SAMHSA", readTime: "24/7", tags: ["Crisis", "Emergency"], category: "crisis", saved: true },
  { id: 6, type: "PDF", title: "First-Gen Student Resource Guide", source: "UMD CARE", readTime: "15 min", tags: ["First-Gen", "Academic"], category: "academic", saved: false },
  { id: 7, type: "Video", title: "Progressive Muscle Relaxation", source: "APA", readTime: "12 min", tags: ["Relaxation", "Body"], category: "physical", saved: false },
  { id: 8, type: "Article", title: "LGBTQ+ Mental Health Resources at UMD", source: "UMD LGBTQ+ Equity Center", readTime: "6 min", tags: ["LGBTQ+", "Support"], category: "lgbtq", saved: false },
  { id: 9, type: "Tool", title: "Grounding Technique: 5-4-3-2-1", source: "Huddle", readTime: "Interactive", tags: ["Grounding", "Anxiety"], category: "anxiety", saved: false },
]

const crisisResources = [
  { name: "Call 988", description: "Suicide & Crisis Lifeline - Available 24/7", action: "Call Now", icon: Phone, color: "#FF6B6B" },
  { name: "Text HOME to 741741", description: "Crisis Text Line - Confidential", action: "Text Now", icon: FileText, color: "#4A9FD4" },
  { name: "UMD Counseling Center", description: "301-314-7651 - M-F 8:30am-4:30pm", action: "Call Now", icon: Phone, color: "#4ECDC4" },
]

const typeConfig: Record<string, { icon: typeof BookOpen; color: string }> = {
  Article: { icon: BookOpen, color: "#4A9FD4" },
  Video: { icon: Video, color: "#FF6B6B" },
  Tool: { icon: Wrench, color: "#4ECDC4" },
  Hotline: { icon: Phone, color: "#FF6B6B" },
  PDF: { icon: FileText, color: "#B8A9E3" },
}

export default function ResourcesPage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [savedItems, setSavedItems] = useState<Record<number, boolean>>(
    Object.fromEntries(resources.filter(r => r.saved).map(r => [r.id, true]))
  )
  const [activeTab, setActiveTab] = useState<"browse" | "saved">("browse")
  const [breatheActive, setBreatheActive] = useState(false)

  const toggleSave = (id: number) => {
    setSavedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filtered = resources.filter(r => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesSaved = activeTab === "saved" ? savedItems[r.id] : true
    return matchesCategory && matchesSearch && matchesSaved
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy">Your Wellness Toolkit</h1>
        <p className="mt-1 text-muted-foreground">Curated resources for UMD students</p>
      </div>

      {/* Search */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources, topics, hotlines..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-4 border-b border-border">
        {(["browse", "saved"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? "border-b-2 border-secondary text-secondary" : "text-muted-foreground hover:text-navy"
            }`}
          >
            {tab === "saved" ? "Saved Resources" : "Browse"}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-secondary text-white"
                : "bg-card text-muted-foreground hover:bg-secondary/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Crisis Resources - Always visible at top */}
      <div className="mt-6 rounded-2xl border-2 border-coral/30 bg-coral/5 p-5">
        <h2 className="font-heading text-lg font-semibold text-navy">Immediate Help</h2>
        <p className="mt-1 text-sm text-muted-foreground">Always available, always confidential</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {crisisResources.map(cr => (
            <div key={cr.name} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: cr.color + "20" }}>
                <cr.icon className="h-5 w-5" style={{ color: cr.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">{cr.name}</p>
                <p className="text-xs text-muted-foreground">{cr.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Self-Help Tools */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Breathing Exercise */}
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="font-heading text-sm font-semibold text-navy">Breathing Exercise</h3>
          <p className="mt-1 text-xs text-muted-foreground">4-7-8 breathing pattern</p>
          <div className="mt-4 flex flex-col items-center">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full bg-secondary/20 text-sm font-medium text-secondary ${
                breatheActive ? "animate-breathe" : ""
              }`}
            >
              {breatheActive ? "Breathe" : "Start"}
            </div>
            <button
              onClick={() => setBreatheActive(!breatheActive)}
              className="mt-3 rounded-full bg-secondary/10 px-4 py-1.5 text-xs font-medium text-secondary"
            >
              {breatheActive ? "Stop" : "Begin Exercise"}
            </button>
          </div>
        </div>

        {/* Grounding Technique */}
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="font-heading text-sm font-semibold text-navy">5-4-3-2-1 Grounding</h3>
          <p className="mt-1 text-xs text-muted-foreground">Bring yourself to the present</p>
          <div className="mt-4 space-y-2">
            {[
              { count: 5, sense: "things you can SEE" },
              { count: 4, sense: "things you can TOUCH" },
              { count: 3, sense: "things you can HEAR" },
              { count: 2, sense: "things you can SMELL" },
              { count: 1, sense: "thing you can TASTE" },
            ].map(item => (
              <div key={item.count} className="flex items-center gap-3 rounded-lg bg-muted p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                  {item.count}
                </span>
                <span className="text-xs text-foreground">{item.sense}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Resource */}
      {activeTab === "browse" && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-navy to-secondary p-6 text-white">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">Featured</span>
          <h2 className="mt-3 font-heading text-xl font-bold">{featuredResource.title}</h2>
          <p className="mt-2 text-sm text-white/80">{featuredResource.description}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-white/60">
            <span>{featuredResource.source}</span>
            <span>{featuredResource.readTime}</span>
          </div>
          <button className="mt-4 rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white">
            Read Now
          </button>
        </div>
      )}

      {/* Resource Grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.map(resource => {
            const config = typeConfig[resource.type] || { icon: BookOpen, color: "#4A9FD4" }
            const TypeIcon = config.icon
            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col rounded-2xl bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: config.color }}
                  >
                    <TypeIcon className="h-3 w-3" />
                    {resource.type}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleSave(resource.id)}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-navy"
                      aria-label={savedItems[resource.id] ? "Remove bookmark" : "Bookmark"}
                    >
                      <Bookmark className={`h-4 w-4 ${savedItems[resource.id] ? "fill-secondary text-secondary" : ""}`} />
                    </button>
                    <button className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-navy" aria-label="Share">
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 flex-1 text-sm font-semibold text-navy">{resource.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{resource.source}</span>
                  <span>{"/"}</span>
                  <span>{resource.readTime}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {resource.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <Heart className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 font-heading font-semibold text-navy">No resources found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
