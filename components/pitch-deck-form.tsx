"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PitchDeckFormData {
  startupName: string
  tagline: string
  problem: string
  solution: string
  market: string
  businessModel: string
  traction: string
  team: string
  competition: string
  fundingAsk: string
  useOfFunds: string
  industry: string
}

export function PitchDeckForm() {
  const [formData, setFormData] = useState<PitchDeckFormData>({
    startupName: "",
    tagline: "",
    problem: "",
    solution: "",
    market: "",
    businessModel: "",
    traction: "",
    team: "",
    competition: "",
    fundingAsk: "",
    useOfFunds: "",
    industry: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleInputChange = (field: keyof PitchDeckFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.startupName || !formData.problem || !formData.solution || !formData.market) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to generate your pitch deck.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate/pitch-deck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to generate pitch deck")
      }

      const result = await response.json()

      // Redirect to the generated pitch deck page
      router.push(`/pitch-deck/${result.id}`)
    } catch (error) {
      console.error("Error generating pitch deck:", error)
      toast({
        title: "Generation Failed",
        description: "There was an error generating your pitch deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Company Information</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startupName">
              Startup Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="startupName"
              value={formData.startupName}
              onChange={(e) => handleInputChange("startupName", e.target.value)}
              placeholder="TechCorp"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={formData.industry} onValueChange={(value) => handleInputChange("industry", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="fintech">FinTech</SelectItem>
                <SelectItem value="healthtech">HealthTech</SelectItem>
                <SelectItem value="edtech">EdTech</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="ai-ml">AI/ML</SelectItem>
                <SelectItem value="blockchain">Blockchain</SelectItem>
                <SelectItem value="iot">IoT</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline/One-liner</Label>
          <Input
            id="tagline"
            value={formData.tagline}
            onChange={(e) => handleInputChange("tagline", e.target.value)}
            placeholder="The future of [industry] is here"
          />
        </div>
      </div>

      {/* Problem & Solution */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Problem & Solution</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="problem">
              Problem Statement <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="problem"
              value={formData.problem}
              onChange={(e) => handleInputChange("problem", e.target.value)}
              placeholder="What problem are you solving? Why is it important?"
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="solution">
              Solution <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="solution"
              value={formData.solution}
              onChange={(e) => handleInputChange("solution", e.target.value)}
              placeholder="How does your product/service solve this problem?"
              rows={3}
              required
            />
          </div>
        </div>
      </div>

      {/* Market & Business Model */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Market & Business</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="market">
              Market Size & Opportunity <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="market"
              value={formData.market}
              onChange={(e) => handleInputChange("market", e.target.value)}
              placeholder="Describe your target market, size, and growth potential"
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessModel">Business Model</Label>
            <Textarea
              id="businessModel"
              value={formData.businessModel}
              onChange={(e) => handleInputChange("businessModel", e.target.value)}
              placeholder="How do you make money? Pricing strategy, revenue streams..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="competition">Competition & Differentiation</Label>
            <Textarea
              id="competition"
              value={formData.competition}
              onChange={(e) => handleInputChange("competition", e.target.value)}
              placeholder="Who are your competitors and what makes you different?"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Traction & Team */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Traction & Team</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="traction">Traction & Milestones</Label>
            <Textarea
              id="traction"
              value={formData.traction}
              onChange={(e) => handleInputChange("traction", e.target.value)}
              placeholder="Key achievements, metrics, partnerships, customers..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team">Team & Expertise</Label>
            <Textarea
              id="team"
              value={formData.team}
              onChange={(e) => handleInputChange("team", e.target.value)}
              placeholder="Key team members, their backgrounds, and relevant experience"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Funding */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Funding</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fundingAsk">Funding Ask</Label>
            <Select value={formData.fundingAsk} onValueChange={(value) => handleInputChange("fundingAsk", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select funding amount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre-seed">Pre-seed ($50K - $250K)</SelectItem>
                <SelectItem value="seed">Seed ($250K - $2M)</SelectItem>
                <SelectItem value="series-a">Series A ($2M - $15M)</SelectItem>
                <SelectItem value="series-b">Series B ($15M - $50M)</SelectItem>
                <SelectItem value="series-c">Series C ($50M+)</SelectItem>
                <SelectItem value="not-fundraising">Not currently fundraising</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="useOfFunds">Use of Funds</Label>
            <Textarea
              id="useOfFunds"
              value={formData.useOfFunds}
              onChange={(e) => handleInputChange("useOfFunds", e.target.value)}
              placeholder="How will you use the funding?"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-accent">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Ready to create your pitch deck?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Our AI will create a compelling 8-10 slide pitch deck that tells your startup's story and attracts
              investors. This usually takes 30-60 seconds.
            </p>
            <Button
              type="submit"
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground px-8"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Pitch Deck...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Pitch Deck
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
