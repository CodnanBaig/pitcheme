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

interface ProposalFormData {
  clientName: string
  clientCompany: string
  projectTitle: string
  projectDescription: string
  goals: string
  budget: string
  timeline: string
  services: string[]
}

export function ProposalForm() {
  const [formData, setFormData] = useState<ProposalFormData>({
    clientName: "",
    clientCompany: "",
    projectTitle: "",
    projectDescription: "",
    goals: "",
    budget: "",
    timeline: "",
    services: [],
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleInputChange = (field: keyof ProposalFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.clientName || !formData.projectDescription || !formData.goals || !formData.budget) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to generate your proposal.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate/proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to generate proposal")
      }

      const result = await response.json()

      // Redirect to the generated proposal page
      router.push(`/proposal/${result.id}`)
    } catch (error) {
      console.error("Error generating proposal:", error)
      toast({
        title: "Generation Failed",
        description: "There was an error generating your proposal. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Client Information</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">
              Client Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => handleInputChange("clientName", e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientCompany">Company Name</Label>
            <Input
              id="clientCompany"
              value={formData.clientCompany}
              onChange={(e) => handleInputChange("clientCompany", e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
        </div>
      </div>

      {/* Project Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Project Information</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input
              id="projectTitle"
              value={formData.projectTitle}
              onChange={(e) => handleInputChange("projectTitle", e.target.value)}
              placeholder="Website Redesign Project"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectDescription">
              Project Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="projectDescription"
              value={formData.projectDescription}
              onChange={(e) => handleInputChange("projectDescription", e.target.value)}
              placeholder="Describe the project, services needed, and key requirements..."
              rows={4}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goals">
              Project Goals <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="goals"
              value={formData.goals}
              onChange={(e) => handleInputChange("goals", e.target.value)}
              placeholder="What are the main objectives and desired outcomes?"
              rows={3}
              required
            />
          </div>
        </div>
      </div>

      {/* Budget & Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Budget & Timeline</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget">
              Budget Range <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.budget} onValueChange={(value) => handleInputChange("budget", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select budget range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="under-5k">Under $5,000</SelectItem>
                <SelectItem value="5k-10k">$5,000 - $10,000</SelectItem>
                <SelectItem value="10k-25k">$10,000 - $25,000</SelectItem>
                <SelectItem value="25k-50k">$25,000 - $50,000</SelectItem>
                <SelectItem value="50k-100k">$50,000 - $100,000</SelectItem>
                <SelectItem value="over-100k">Over $100,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">Timeline</Label>
            <Select value={formData.timeline} onValueChange={(value) => handleInputChange("timeline", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-2-weeks">1-2 weeks</SelectItem>
                <SelectItem value="3-4-weeks">3-4 weeks</SelectItem>
                <SelectItem value="1-2-months">1-2 months</SelectItem>
                <SelectItem value="3-6-months">3-6 months</SelectItem>
                <SelectItem value="6-months-plus">6+ months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Additional Services */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
        <div className="space-y-2">
          <Label htmlFor="services">Services/Deliverables</Label>
          <Textarea
            id="services"
            value={formData.services.join(", ")}
            onChange={(e) => handleInputChange("services", e.target.value)}
            placeholder="List specific services, deliverables, or features to include..."
            rows={3}
          />
        </div>
      </div>

      {/* Generate Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Ready to generate your proposal?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Our AI will create a professional, tailored proposal based on your input. This usually takes 30-60
              seconds.
            </p>
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90 px-8" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Proposal...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Proposal
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
