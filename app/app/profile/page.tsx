"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Edit3, Flame, Shield, Users, MessageCircle, Award, FileText,
  Eye, EyeOff, Camera, Save, X, Calendar, Heart,
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { useProfile } from "@/hooks/use-profile"
import { toast } from "sonner"

const defaultProfileData = {
  name: "Anonymous Terp",
  anonymous: false,
  year: "—",
  major: "—",
  joined: "—",
  streak: 0,
  level: 1,
  levelTitle: "New Member",
  bio: "Share your story when you're ready.",
  hereFor: [] as string[],
  interests: [] as string[],
  supportStyle: "Both",
  availability: ["Afternoon", "Evening", "Weekends"],
  stats: { communities: 0, connections: 0, posts: 0, badges: 0 },
}

const userPosts = [
  { id: 1, content: "Had a breakthrough in therapy today. Small wins matter.", time: "2 days ago", likes: 15, comments: 4 },
  { id: 2, content: "If anyone needs a study buddy for algorithms, I'm free this weekend. Sometimes just having someone there helps.", time: "4 days ago", likes: 22, comments: 7 },
  { id: 3, content: "Reminder: It's okay to take a mental health day. Your GPA doesn't define your worth.", time: "1 week ago", likes: 45, comments: 12 },
]

const userBadges = [
  { name: "First Connection", earned: true },
  { name: "Conversation Starter", earned: true },
  { name: "Community Builder", earned: true },
  { name: "Consistent", earned: true },
  { name: "Night Owl", earned: true },
  { name: "Resource Guru", earned: true },
  { name: "Event Enthusiast", earned: true },
  { name: "1 Month Member", earned: true },
  { name: "Super Supporter", earned: false },
  { name: "On Fire", earned: false },
  { name: "Zen Master", earned: false },
  { name: "Bridge Builder", earned: false },
]

const userCommunities = [
  { name: "Anxiety Allies", role: "Member", members: 234, active: true },
  { name: "CS Students Support", role: "Moderator", members: 156, active: true },
  { name: "Music Heals", role: "Member", members: 89, active: false },
  { name: "First-Gen College", role: "Member", members: 312, active: true },
  { name: "Meditation Circle", role: "Member", members: 67, active: false },
]

export default function ProfilePage() {
  const { user } = useAuth()
  const { profile, studentDetails, loading, updateProfile } = useProfile(user?.id)
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [anonymousMode, setAnonymousMode] = useState(false)

  const profileData = {
    ...defaultProfileData,
    name: profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email : defaultProfileData.name,
    year: studentDetails?.academic_year ?? defaultProfileData.year,
    major: profile?.major ?? defaultProfileData.major,
    joined: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : defaultProfileData.joined,
    bio: profile?.bio ?? defaultProfileData.bio,
    hereFor: (studentDetails?.skills ?? []) as string[],
    interests: (studentDetails?.interests ?? []) as string[],
    stats: { ...defaultProfileData.stats },
  }

  useEffect(() => {
    setBio(profile?.bio ?? defaultProfileData.bio)
  }, [profile?.bio])

  const handleSaveBio = async () => {
    try {
      await updateProfile({ bio })
      setEditing(false)
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    }
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <div className="animate-pulse rounded-2xl bg-muted h-64" />
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-secondary to-sky">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.2),transparent_50%)]" />
        </div>
        <div className="relative px-6 pb-6 pt-16 text-center md:pt-12">
          {/* Avatar */}
          <div className="relative mx-auto h-24 w-24">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-coral text-3xl font-bold text-white ring-4 ring-mint">
              {anonymousMode ? "?" : profileData.name.charAt(0).toUpperCase()}
            </div>
            <button
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-card text-navy shadow-sm"
              aria-label="Change avatar"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          {/* Name and Info */}
          <h1 className="mt-4 font-heading text-2xl font-bold text-white">
            {anonymousMode ? "Anonymous Terp" : profileData.name}
          </h1>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/80">
            <span>{profileData.year}</span>
            <span>{"/"}</span>
            <span>{profileData.major}</span>
            <Shield className="ml-1 h-4 w-4 text-mint" />
            <span className="text-xs text-mint">UMD Verified</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {profileData.joined}</span>
            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-coral" /> {profileData.streak} day streak</span>
            <span className="flex items-center gap-1"><Award className="h-3 w-3 text-lavender" /> Level {profileData.level}</span>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              {editing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              {editing ? "Cancel" : "Edit Profile"}
            </button>
            <button
              onClick={() => setAnonymousMode(!anonymousMode)}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              {anonymousMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {anonymousMode ? "Anonymous On" : "Anonymous Off"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          { label: "Communities", value: profileData.stats.communities, icon: Users },
          { label: "Connections", value: profileData.stats.connections, icon: Heart },
          { label: "Posts", value: profileData.stats.posts, icon: FileText },
          { label: "Badges", value: profileData.stats.badges, icon: Award },
        ].map(stat => (
          <div key={stat.label} className="flex flex-col items-center rounded-xl bg-card p-3 shadow-sm">
            <stat.icon className="h-4 w-4 text-secondary" />
            <span className="mt-1 font-heading text-lg font-bold text-navy">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Profile Tabs */}
      <Tabs defaultValue="about" className="mt-6">
        <TabsList className="w-full justify-start bg-transparent">
          {["About", "Posts", "Badges", "Communities"].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="data-[state=active]:border-b-2 data-[state=active]:border-secondary data-[state=active]:text-secondary"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="about" className="mt-4 space-y-4">
          {/* Bio */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-navy">My Story</h3>
            {editing ? (
              <div className="mt-2">
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-xl" maxLength={250} />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{bio.length}/250</span>
                  <button onClick={handleSaveBio} className="flex items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold text-white">
                    <Save className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-foreground">{bio}</p>
            )}
          </div>

          {/* Here For */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-navy">{"I'm"} Here For</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(profileData.hereFor.length > 0 ? profileData.hereFor : ["Add your support reasons in onboarding"]).map(tag => (
                <Badge key={tag} variant="secondary" className="bg-coral/10 text-coral">{tag}</Badge>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-navy">My Interests</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(profileData.interests.length > 0 ? profileData.interests : ["Add interests in onboarding"]).map(interest => (
                <Badge key={interest} variant="secondary" className="bg-secondary/10 text-secondary">{interest}</Badge>
              ))}
            </div>
          </div>

          {/* Support & Availability */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-navy">Support Style</h3>
              <p className="mt-2 text-sm text-muted-foreground">Giving & Receiving</p>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-navy">Availability</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                {profileData.availability.map(a => (
                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="posts" className="mt-4 space-y-3">
          {userPosts.map(post => (
            <div key={post.id} className="rounded-2xl bg-card p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-foreground">{post.content}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>{post.time}</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.comments}</span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="badges" className="mt-4">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {userBadges.map(badge => (
              <motion.div
                key={badge.name}
                whileHover={{ scale: 1.05 }}
                className={`flex flex-col items-center rounded-2xl p-3 text-center ${
                  badge.earned ? "bg-card shadow-sm" : "bg-muted/50 opacity-50"
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  badge.earned ? "bg-gradient-to-br from-secondary to-mint text-white" : "bg-border text-muted-foreground"
                }`}>
                  <Award className="h-5 w-5" />
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-navy">{badge.name}</p>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="communities" className="mt-4 space-y-3">
          {userCommunities.map(community => (
            <div key={community.name} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-sm font-bold text-secondary">
                {community.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy">{community.name}</p>
                  {community.active && <span className="h-2 w-2 rounded-full bg-mint" />}
                </div>
                <p className="text-xs text-muted-foreground">{community.role} - {community.members} members</p>
              </div>
              <button className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">View</button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
