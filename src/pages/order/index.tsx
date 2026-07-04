import { useTranslation } from "react-i18next";
import { StitchMobileOrderNew } from "@/components/stitch";

export function OrderPage() {
  const { t } = useTranslation("stitch");
  return <StitchMobileOrderNew />;
}
