import { EnhancedPitchDeckForm } from "@/components/enhanced-pitch-deck-form"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PresentationIcon as PresentationChart, CheckCircle } from "lucide-react"
import { PageHeading } from "@/components/page-heading"

export default function GeneratePitchDeckPage() {
  return (
    <>
          <PageHeading
            eyebrow="New investor document"
            title="Generate Pitch Deck"
            description="Capture company, market, traction, and funding context for a structured investor narrative."
          />

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_17rem]">
            {/* Form */}
            <section aria-labelledby="pitch-brief-heading">
              <div className="mb-6 border-b border-border pb-4">
                <h2 id="pitch-brief-heading" className="text-lg font-semibold text-foreground">Pitch brief</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the company’s industry, then provide the market, solution, and funding context.</p>
              </div>
              <EnhancedPitchDeckForm />
            </section>

            {/* Info Sidebar */}
            <aside>
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">Slides included</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Title & Company Overview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Problem Statement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Solution & Value Proposition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Market Size & Opportunity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Business Model</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Traction & Milestones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Team & Expertise</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Financial Projections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Funding Ask & Use of Funds</span>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-accent/70 py-5">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                    <PresentationChart className="w-5 h-5 text-primary" />
                    Investor narrative
                    </p>
                    <p className="mt-2 text-sm leading-6 text-accent-foreground">
                      Your inputs become a reviewable slide sequence with a clear investor narrative.
                    </p>
                  </div>
                </CardFooter>
              </Card>
            </aside>
          </div>
    </>
  )
}
