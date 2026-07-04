import { useTranslation } from "react-i18next";
import { HelmetHead } from "@/components/seo/HelmetHead";
import { StitchMobileOrderNew } from "@/components/stitch";

export function OrderPage() {
  const { t } = useTranslation(["stitch", "order"]);
  return (
    <>
      <HelmetHead
        title={t("order:seoTitle")}
        description={t("order:seoDescription")}
        canonical="/order"
      />
      <StitchMobileOrderNew />
    </>
  );
}
