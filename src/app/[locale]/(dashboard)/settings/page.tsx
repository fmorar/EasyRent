import { requireAuth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProfileSettingsForm from "./profile-settings-form"
import SecuritySettingsForm from "./security-settings-form"

export default async function SettingsPage() {
  const { profile } = await requireAuth()
  const t = await getTranslations("settings")

  return (
    <div className="mx-auto max-w-3xl space-y-(--spacing-section)">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-(--spacing-block)">
        <TabsList>
          <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
          <TabsTrigger value="security">{t("tabSecurity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettingsForm profile={profile} />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettingsForm profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
