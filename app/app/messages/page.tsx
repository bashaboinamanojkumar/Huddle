"use client"

import { useState } from "react"
import { Search, Send, Smile, Paperclip, Heart, MoreHorizontal, Info, Bell, AlertTriangle, Mic } from "lucide-react"

const conversations = [
  { id: 1, name: "Jamie K.", avatar: "J", lastMessage: "That sounds really hard. I'm here for you.", time: "2m ago", unread: 2, online: true, type: "match" },
  { id: 2, name: "Anxiety Allies", avatar: "A", lastMessage: "Sarah: Thank you all for the support today!", time: "15m ago", unread: 5, online: true, type: "community" },
  { id: 3, name: "Riley P.", avatar: "R", lastMessage: "Want to grab coffee at Stamp?", time: "1h ago", unread: 0, online: false, type: "match" },
  { id: 4, name: "Anonymous Terp", avatar: "?", lastMessage: "I really appreciate you listening", time: "3h ago", unread: 0, online: false, type: "support" },
  { id: 5, name: "Marcus T.", avatar: "M", lastMessage: "The workshop was amazing!", time: "1d ago", unread: 0, online: true, type: "match" },
]

const messages = [
  { id: 1, sender: "them", text: "Hey! I saw we matched. I'm also dealing with academic stress.", time: "10:30 AM", type: "text" },
  { id: 2, sender: "system", text: "You matched with Jamie 3 days ago", time: "", type: "system" },
  { id: 3, sender: "me", text: "Hi Jamie! Yes, midterms have been really tough this semester.", time: "10:32 AM", type: "text" },
  { id: 4, sender: "them", text: "Same here. I find it helps to talk about it. Have you tried the breathing exercises in the resource library?", time: "10:35 AM", type: "text" },
  { id: 5, sender: "me", text: "I haven't yet! I'll check them out. It's nice to know someone understands.", time: "10:38 AM", type: "text" },
  { id: 6, sender: "them", text: "That sounds really hard. I'm here for you.", time: "10:40 AM", type: "text" },
]

const suggestions = [
  "I'm here for you",
  "That sounds really hard",
  "Want to talk more about this?",
]

export default function MessagesPage() {
  const [activeConv, setActiveConv] = useState(conversations[0])
  const [messageText, setMessageText] = useState("")
  const [chatMessages, setChatMessages] = useState(messages)
  const [filter, setFilter] = useState("All")
  const [showMobileChat, setShowMobileChat] = useState(false)

  const handleSend = () => {
    if (!messageText.trim()) return
    setChatMessages((prev) => [
      ...prev,
      { id: prev.length + 1, sender: "me", text: messageText, time: "Now", type: "text" },
    ])
    setMessageText("")
  }

  const handleSuggestion = (text: string) => {
    setChatMessages((prev) => [
      ...prev,
      { id: prev.length + 1, sender: "me", text, time: "Now", type: "text" },
    ])
  }

  const filteredConversations = conversations.filter((c) => {
    if (filter === "All") return true
    if (filter === "Peer Matches") return c.type === "match"
    if (filter === "Communities") return c.type === "community"
    if (filter === "Support") return c.type === "support"
    return true
  })

  return (
    <div className="flex h-[calc(100vh-57px)] bg-background">
      {/* Conversations List */}
      <div className={`w-full flex-shrink-0 border-r border-border bg-card md:w-80 ${showMobileChat ? "hidden md:block" : ""}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="font-heading text-lg font-semibold text-navy">Messages</h1>
          <div className="flex gap-2">
            <button className="text-muted-foreground hover:text-navy" aria-label="Search messages"><Search className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 py-2">
          {["All", "Peer Matches", "Communities", "Support"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? "bg-navy text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => { setActiveConv(conv); setShowMobileChat(true) }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                activeConv.id === conv.id ? "bg-secondary/5" : ""
              }`}
            >
              <div className="relative">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: conv.avatar === "?" ? "#6B7280" : "#4A9FD4" }}
                >
                  {conv.avatar}
                </div>
                {conv.online && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-mint" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy">{conv.name}</span>
                  <span className="text-[10px] text-muted-foreground">{conv.time}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
              </div>
              {conv.unread > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[10px] font-bold text-white">
                  {conv.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className={`flex flex-1 flex-col ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMobileChat(false)} className="text-muted-foreground md:hidden">
              Back
            </button>
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
                {activeConv.avatar}
              </div>
              {activeConv.online && (
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-mint" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">{activeConv.name}</p>
              <p className="text-xs text-muted-foreground">{activeConv.online ? "Online" : "Offline"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-muted-foreground hover:text-navy" aria-label="Mute"><Bell className="h-4 w-4" /></button>
            <button className="text-muted-foreground hover:text-navy" aria-label="Info"><Info className="h-4 w-4" /></button>
            <button className="text-muted-foreground hover:text-navy" aria-label="Report"><AlertTriangle className="h-4 w-4" /></button>
            <button className="text-muted-foreground hover:text-navy" aria-label="More"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Peer support banner */}
        <div className="bg-secondary/5 px-4 py-2 text-center text-xs text-secondary">
          This is a peer support conversation. Be kind and supportive.
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {chatMessages.map((msg) => {
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="text-center text-xs text-muted-foreground">{msg.text}</div>
              )
            }
            return (
              <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.sender === "me"
                      ? "bg-navy text-white"
                      : "bg-secondary/10 text-foreground"
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p className={`mt-1 text-[10px] ${msg.sender === "me" ? "text-white/50" : "text-muted-foreground"}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Smart Suggestions */}
        <div className="flex gap-2 overflow-x-auto px-4 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="flex-shrink-0 rounded-full bg-secondary/10 px-3 py-1 text-xs text-secondary transition-colors hover:bg-secondary/20"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Message Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2">
            <button className="text-muted-foreground hover:text-navy" aria-label="Emoji"><Smile className="h-5 w-5" /></button>
            <button className="text-muted-foreground hover:text-navy" aria-label="Attach"><Paperclip className="h-5 w-5" /></button>
            <button className="text-muted-foreground hover:text-navy" aria-label="Share resource"><Heart className="h-5 w-5" /></button>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Say something kind..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button className="text-muted-foreground hover:text-navy" aria-label="Voice message"><Mic className="h-5 w-5" /></button>
            <button
              onClick={handleSend}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white transition-colors hover:bg-dark-navy"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
