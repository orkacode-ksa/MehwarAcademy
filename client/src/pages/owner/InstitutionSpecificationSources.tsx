import { useNavigate, useParams } from "react-router-dom";
import { AcademicSpecificationSources } from "../faculty/AcademicSpecificationSources.js";

export function InstitutionSpecificationSources() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  return <AcademicSpecificationSources tenantId={tenantId} onClose={() => navigate("/institutions")} onBrowseTemplates={() => navigate("/institutions")} />;
}
