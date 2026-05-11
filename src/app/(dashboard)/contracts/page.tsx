import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentTextIcon as FileText } from "@heroicons/react/24/outline"

export default async function ContractsPage() {
  await requireAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contracts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contract generation and management
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contract generation from templates is in development.
            Once available, you&apos;ll be able to create, send, and track contracts
            directly from a lead&apos;s pipeline card.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
