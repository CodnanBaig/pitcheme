import { EnhancedProposalForm } from "@/components/enhanced-proposal-form"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, CheckCircle } from "lucide-react"
import { PageHeading } from "@/components/page-heading"

export default function GenerateProposalPage() {
  return (
    <>
          <PageHeading
            eyebrow="New business document"
            title="Generate Proposal"
            description="Capture the client, scope, timing, and commercial context needed for a structured first draft."
          />

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_17rem]">
            {/* Form */}
            <section aria-labelledby="proposal-brief-heading">
              <div className="mb-6 border-b border-border pb-4">
                <h2 id="proposal-brief-heading" className="text-lg font-semibold text-foreground">Proposal brief</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the client’s industry, then provide the scope and commercial context.</p>
              </div>
              <EnhancedProposalForm />
            </section>

            {/* Info Sidebar */}
            <aside>
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">What you’ll produce</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Professional cover page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Executive summary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Detailed project scope</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Timeline & milestones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Pricing breakdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Call-to-action</span>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-accent/70 py-5">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                    <FileText className="w-5 h-5 text-primary" />
                    Structured generation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-accent-foreground">
                      Your inputs become an editable first draft with a consistent business structure.
                    </p>
                  </div>
                </CardFooter>
              </Card>
            </aside>
          </div>
    </>
  )
}
