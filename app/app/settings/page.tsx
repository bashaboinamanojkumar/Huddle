"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  User, Shield, Bell, Eye, Accessibility, AlertTriangle, FileText,
  ChevronRight, Trash2, Download, Lock,
} from "lucide-react"

const settingsCategories = [
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy & Safety", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "content", label: "Content Preferences", icon: Eye },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "crisis", label: "Crisis & Support", icon: AlertTriangle },
  { id: "about", label: "About & Legal", icon: FileText },
]

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState("account")
  const [settings, setSettings] = useState({
    profileVisibility: "everyone",
    showYearMajor: true,
    allowMatching: true,
    allowDMs: "matches",
    anonymousMode: false,
    pushNotifications: true,
    dailyCheckIn: true,
    checkInTime: "09:00",
    newMatches: true,
    messages: true,
    communityActivity: true,
    eventReminders: true,
    achievementUnlocked: true,
    weeklySummary: true,
    contentWarnings: true,
    feedPreference: "connection",
    fontSize: [16],
    highContrast: false,
    reduceMotion: false,
    screenReaderOptimized: false,
    colorBlindMode: false,
    crisisContact: "",
    checkInBuddy: false,
  })

  const updateSetting = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <h1 className="font-heading text-2xl font-bold text-navy">Settings</h1>
      <p className="mt-1 text-muted-foreground">Manage your account and preferences</p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <nav className="flex gap-2 overflow-x-auto lg:w-56 lg:flex-shrink-0 lg:flex-col">
          {settingsCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors lg:w-full ${
                activeCategory === cat.id
                  ? "bg-secondary/10 font-semibold text-secondary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <cat.icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Account */}
          {activeCategory === "account" && (
            <>
              <div className="rounded-2xl bg-card p-5 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-navy">Account Settings</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Email Address</Label>
                    <Input value="alex.thompson@umd.edu" disabled className="mt-1 rounded-xl bg-muted" />
                    <p className="mt-1 text-xs text-muted-foreground">UMD email cannot be changed</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Password</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input type="password" value="********" disabled className="rounded-xl bg-muted" />
                      <button className="rounded-full bg-secondary/10 px-4 py-2 text-xs font-medium text-secondary hover:bg-secondary/20">
                        Change
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Connected Accounts</Label>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-muted p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card">G</div>
                        <span className="text-sm text-foreground">Google</span>
                      </div>
                      <span className="text-xs text-mint">Connected</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-destructive/20 bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-destructive">
                  <Trash2 className="h-4 w-4" /> Danger Zone
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Deleting your account is permanent and cannot be undone.</p>
                <button className="mt-3 rounded-full bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/20">
                  Delete Account
                </button>
              </div>
            </>
          )}

          {/* Privacy & Safety */}
          {activeCategory === "privacy" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">Privacy & Safety</h2>
              <div className="mt-4 space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground">Profile Visibility</Label>
                  <Select value={settings.profileVisibility} onValueChange={(v) => updateSetting("profileVisibility", v)}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="matches">Matches Only</SelectItem>
                      <SelectItem value="me">Just Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SettingToggle label="Show year and major" checked={settings.showYearMajor} onChange={(v) => updateSetting("showYearMajor", v)} />
                <SettingToggle label="Allow peer matching" checked={settings.allowMatching} onChange={(v) => updateSetting("allowMatching", v)} />
                <div>
                  <Label className="text-sm font-medium text-foreground">Allow direct messages from</Label>
                  <Select value={settings.allowDMs} onValueChange={(v) => updateSetting("allowDMs", v)}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="matches">Matches Only</SelectItem>
                      <SelectItem value="nobody">Nobody</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SettingToggle label="Anonymous mode (all posts anonymous by default)" checked={settings.anonymousMode} onChange={(v) => updateSetting("anonymousMode", v)} />
                <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Manage blocked users</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </div>
                <button className="flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2 text-xs font-medium text-secondary">
                  <Download className="h-3 w-3" /> Request data download
                </button>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeCategory === "notifications" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">Notifications</h2>
              <div className="mt-4 space-y-5">
                <SettingToggle label="Push notifications" checked={settings.pushNotifications} onChange={(v) => updateSetting("pushNotifications", v)} bold />
                <hr className="border-border" />
                <SettingToggle label="Daily check-in reminder" checked={settings.dailyCheckIn} onChange={(v) => updateSetting("dailyCheckIn", v)} />
                {settings.dailyCheckIn && (
                  <div className="ml-8">
                    <Label className="text-xs text-muted-foreground">Reminder time</Label>
                    <Input
                      type="time"
                      value={settings.checkInTime}
                      onChange={(e) => updateSetting("checkInTime", e.target.value)}
                      className="mt-1 w-32 rounded-xl"
                    />
                  </div>
                )}
                <SettingToggle label="New matches" checked={settings.newMatches} onChange={(v) => updateSetting("newMatches", v)} />
                <SettingToggle label="Messages" checked={settings.messages} onChange={(v) => updateSetting("messages", v)} />
                <SettingToggle label="Community activity" checked={settings.communityActivity} onChange={(v) => updateSetting("communityActivity", v)} />
                <SettingToggle label="Event reminders" checked={settings.eventReminders} onChange={(v) => updateSetting("eventReminders", v)} />
                <SettingToggle label="Achievement unlocked" checked={settings.achievementUnlocked} onChange={(v) => updateSetting("achievementUnlocked", v)} />
                <SettingToggle label="Weekly mood summary" checked={settings.weeklySummary} onChange={(v) => updateSetting("weeklySummary", v)} />
              </div>
            </div>
          )}

          {/* Content Preferences */}
          {activeCategory === "content" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">Content Preferences</h2>
              <div className="mt-4 space-y-5">
                <SettingToggle label="Show content warnings" checked={settings.contentWarnings} onChange={(v) => updateSetting("contentWarnings", v)} />
                <div>
                  <Label className="text-sm font-medium text-foreground">Feed focus</Label>
                  <p className="text-xs text-muted-foreground">Show me more of...</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { id: "connection", label: "Connection-focused" },
                      { id: "resource", label: "Resource-focused" },
                      { id: "event", label: "Event-focused" },
                    ].map(pref => (
                      <button
                        key={pref.id}
                        onClick={() => updateSetting("feedPreference", pref.id)}
                        className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                          settings.feedPreference === pref.id
                            ? "bg-secondary text-white"
                            : "bg-muted text-muted-foreground hover:bg-secondary/10"
                        }`}
                      >
                        {pref.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accessibility */}
          {activeCategory === "accessibility" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">Accessibility</h2>
              <div className="mt-4 space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground">Font Size</Label>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">A</span>
                    <Slider
                      value={settings.fontSize}
                      onValueChange={(v) => updateSetting("fontSize", v)}
                      min={12}
                      max={24}
                      step={2}
                      className="flex-1"
                    />
                    <span className="text-lg text-muted-foreground">A</span>
                    <span className="w-8 text-center text-sm font-medium text-navy">{settings.fontSize[0]}px</span>
                  </div>
                </div>
                <SettingToggle label="High contrast mode" checked={settings.highContrast} onChange={(v) => updateSetting("highContrast", v)} />
                <SettingToggle label="Reduce motion" description="Turns off animations throughout the app" checked={settings.reduceMotion} onChange={(v) => updateSetting("reduceMotion", v)} />
                <SettingToggle label="Screen reader optimized view" checked={settings.screenReaderOptimized} onChange={(v) => updateSetting("screenReaderOptimized", v)} />
                <SettingToggle label="Color blind mode" description="Adjusts color palette for better visibility" checked={settings.colorBlindMode} onChange={(v) => updateSetting("colorBlindMode", v)} />
              </div>
            </div>
          )}

          {/* Crisis & Support */}
          {activeCategory === "crisis" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">Crisis & Support Settings</h2>
              <div className="mt-4 space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground">Emergency Contact</Label>
                  <p className="text-xs text-muted-foreground">Trusted person to notify in case of crisis</p>
                  <Input
                    type="tel"
                    value={settings.crisisContact}
                    onChange={(e) => updateSetting("crisisContact", e.target.value)}
                    placeholder="Phone number"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-medium text-foreground">Safety Plan</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Create or update your personal safety plan</p>
                  <button className="mt-2 rounded-full bg-secondary/10 px-4 py-1.5 text-xs font-medium text-secondary">
                    Open Safety Plan Tool
                  </button>
                </div>
                <SettingToggle
                  label="Check-in buddy"
                  description="Get a ping from a friend if you miss 3 days of check-ins"
                  checked={settings.checkInBuddy}
                  onChange={(v) => updateSetting("checkInBuddy", v)}
                />
              </div>
            </div>
          )}

          {/* About & Legal */}
          {activeCategory === "about" && (
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-navy">About & Legal</h2>
              <div className="mt-4 space-y-2">
                {[
                  "Community Guidelines",
                  "Privacy Policy",
                  "Terms of Service",
                  "Open Source Credits",
                ].map(item => (
                  <button key={item} className="flex w-full items-center justify-between rounded-xl p-3 text-sm text-foreground transition-colors hover:bg-muted">
                    {item}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                <p className="mt-4 text-center text-xs text-muted-foreground">Hudrdle v1.0.0</p>
                <p className="text-center text-xs text-muted-foreground">Built with care by UMD students</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  bold,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm ${bold ? "font-semibold text-navy" : "text-foreground"}`}>{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
