import fs from 'node:fs';

const baseFront = 'd:/TRABAJO/DCMTIC/FRONT/comunidadinformatica.administrador';

// ==========================================
// 1. ICodelist.model.ts: add status to ICodelistImportOptions
// ==========================================
const codelistModelPath = `${baseFront}/src/general/interfaces/ICodelist.model.ts`;
let cmCode = fs.readFileSync(codelistModelPath, 'utf8');
if (!cmCode.includes('status?: number | string;')) {
  cmCode = cmCode.replace(
    'additionalColumnsDataType?: number;\r\n}',
    'additionalColumnsDataType?: number;\r\n  status?: number | string;\r\n}'
  ).replace(
    'additionalColumnsDataType?: number;\n}',
    'additionalColumnsDataType?: number;\n  status?: number | string;\n}'
  );
  fs.writeFileSync(codelistModelPath, cmCode, 'utf8');
  console.log('ICodelist.model.ts updated with status');
}

// ==========================================
// 2. Admin.service.ts: pass Status in importCodelistCsv
// ==========================================
const adminServicePath = `${baseFront}/src/general/services/Admin.service.ts`;
let asCode = fs.readFileSync(adminServicePath, 'utf8');
if (!asCode.includes('Status: options.status,')) {
  asCode = asCode.replace(
    'AdditionalColumnsDataType: options.additionalColumnsDataType ?? 0,',
    'AdditionalColumnsDataType: options.additionalColumnsDataType ?? 0,\r\n          Status: options.status,'
  );
  fs.writeFileSync(adminServicePath, asCode, 'utf8');
  console.log('Admin.service.ts updated with Status param');
}

// ==========================================
// 3. Approvals.service.ts: update getPending in wrapper object
// ==========================================
const approvalsServicePath = `${baseFront}/src/modules/Approvals/services/Approvals.service.ts`;
let aprCode = fs.readFileSync(approvalsServicePath, 'utf8');
aprCode = aprCode.replace(
  /getPending:\s*\(\)\s*:\s*Promise<IApprovalRequest\[\]>\s*=>\r?\n\s*defaultApprovalsService\.getPendingApprovals\(\),/,
  'getPending: (entityType?: string): Promise<IApprovalRequest[]> =>\r\n    defaultApprovalsService.getPendingApprovals(entityType),'
);
fs.writeFileSync(approvalsServicePath, aprCode, 'utf8');
console.log('Approvals.service.ts wrapper getPending updated');

// ==========================================
// 4. ListGlosario.tsx: clean handleSendForReview and standardize buttons
// ==========================================
const glosarioPath = `${baseFront}/src/modules/Glosario/components/ListGlosario.tsx`;
let gloCode = fs.readFileSync(glosarioPath, 'utf8');

// remove unused handleSendForReview if declared
gloCode = gloCode.replace(
  /const handleSendForReview = async \([\s\S]*?\n\s*\}\s*;\r?\n/,
  ''
);

// In ListGlosario form buttons (lines ~1630):
const oldGlosarioButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-3 mt-2 ">
        <div className="d-flex gap-2">
          <Button type="submit" styleType="primary" disabled={saving || isDiscarding}>
            {submitLabel}
          </Button>
          {canDiscard && (
            <Button
              type="button"
              styleType="link-danger"
              disabled={saving || isDiscarding}
              onClick={handleDiscardDraft}
            >
              {isDiscarding ? "Descartando..." : "Descartar borrador"}
            </Button>
          )}
        </div>
        <Button
          type="button"
          styleType="link-warning"
          disabled={saving || isDiscarding}
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </div>`;

const newGlosarioButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-3 mt-2 ">
        <div className="d-flex gap-2">
          <Button
            type="button"
            styleType="primary"
            disabled={saving || isDiscarding}
            onClick={(e) => void handleSaveWithStatus(e, ArtifactStatus.PendingReview)}
          >
            {saving && saveTargetStatus === ArtifactStatus.PendingReview ? "Enviando..." : "Enviar a revisión"}
          </Button>
          <Button
            type="button"
            styleType="secondary"
            disabled={saving || isDiscarding}
            onClick={(e) => void handleSaveWithStatus(e, ArtifactStatus.Draft)}
          >
            {saving && saveTargetStatus === ArtifactStatus.Draft ? "Guardando..." : "Guardar borrador"}
          </Button>
          {canDiscard && (
            <Button
              type="button"
              styleType="link-danger"
              disabled={saving || isDiscarding}
              onClick={handleDiscardDraft}
            >
              {isDiscarding ? "Descartando..." : "Descartar borrador"}
            </Button>
          )}
        </div>
        <Button
          type="button"
          styleType="link-warning"
          disabled={saving || isDiscarding}
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </div>`;

gloCode = gloCode.replace(oldGlosarioButtons.replace(/\r\n/g, '\n'), newGlosarioButtons);
gloCode = gloCode.replace(oldGlosarioButtons, newGlosarioButtons);

// Add saveTargetStatus state and handleSaveWithStatus in ListGlosario
if (!gloCode.includes('saveTargetStatus')) {
  gloCode = gloCode.replace(
    'const [saving, setSaving] = useState(false);',
    'const [saving, setSaving] = useState(false);\r\n  const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);'
  );

  const saveWithStatusFunc = `  const handleSaveWithStatus = async (
    event: React.MouseEvent<HTMLButtonElement>,
    targetStatus: ArtifactStatus,
  ) => {
    event.preventDefault();
    setSaveTargetStatus(targetStatus);
    await executeConceptSave(targetStatus);
  };

  const executeConceptSave = async (targetStatus: ArtifactStatus) => {`;

  gloCode = gloCode.replace(
    'const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {\r\n    event.preventDefault();',
    `${saveWithStatusFunc}\r\n    // executeConceptSave body`
  );
  gloCode = gloCode.replace(
    'const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {\n    event.preventDefault();',
    `${saveWithStatusFunc}\n    // executeConceptSave body`
  );

  // When saving completes in ListGlosario, if targetStatus === PendingReview, call submitForReview
  gloCode = gloCode.replace(
    'setSelectedId(saved.id);\r\n      setForm(mapToForm(saved));',
    `if (targetStatus === ArtifactStatus.PendingReview && saved.id) {
        try {
          await approvalsService.submitForReview(saved.id, "Concept");
        } catch (subErr) {
          console.warn("Concepto guardado pero no se pudo enviar automticamente a revisin:", subErr);
        }
      }
      setSelectedId(saved.id);
      setForm(mapToForm(saved));`
  );
  gloCode = gloCode.replace(
    'setSelectedId(saved.id);\n      setForm(mapToForm(saved));',
    `if (targetStatus === ArtifactStatus.PendingReview && saved.id) {
        try {
          await approvalsService.submitForReview(saved.id, "Concept");
        } catch (subErr) {
          console.warn("Concepto guardado pero no se pudo enviar automticamente a revisin:", subErr);
        }
      }
      setSelectedId(saved.id);
      setForm(mapToForm(saved));`
  );

  // In renderConceptForm, update form tag
  gloCode = gloCode.replace(
    '<form onSubmit={handleSubmit} className="d-flex flex-column gap-3 pt-2">',
    '<form onSubmit={(e) => { e.preventDefault(); void executeConceptSave(saveTargetStatus); }} className="d-flex flex-column gap-3 pt-2">'
  );
}

fs.writeFileSync(glosarioPath, gloCode, 'utf8');
console.log('ListGlosario.tsx buttons standardized');

// ==========================================
// 5. FormSection.tsx: standardize buttons
// ==========================================
const sectionFormPath = `${baseFront}/src/modules/SectionEditor/components/FormSection.tsx`;
let secCode = fs.readFileSync(sectionFormPath, 'utf8');

if (!secCode.includes('saveTargetStatus')) {
  secCode = secCode.replace(
    'const [saving, setSaving] = useState(false);',
    'const [saving, setSaving] = useState(false);\r\n  const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);'
  );

  secCode = secCode.replace(
    'const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {',
    `const handleSaveWithStatus = async (targetStatus: ArtifactStatus) => {
    setSaveTargetStatus(targetStatus);
    await executeSave(targetStatus);
  };

  const executeSave = async (targetStatus: ArtifactStatus) => {`
  );

  secCode = secCode.replace(
    'status: ArtifactStatus.Available,',
    'status: targetStatus,'
  );

  const oldSecButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
          <div className="d-flex gap-2">
            <Button type="submit" styleType="primary" disabled={saving || isDiscarding}>
              {submitLabel}
            </Button>
            {canDiscard && (
              <Button
                type="button"
                styleType="link-danger"
                disabled={saving || isDiscarding}
                onClick={handleDiscardDraft}
              >
                {isDiscarding ? "Descartando..." : "Descartar borrador"}
              </Button>
            )}
          </div>
          <Button
            type="button"
            styleType="link-warning"
            onClick={handleClose}
            disabled={saving || isDiscarding}
          >
            Cancelar
          </Button>
        </div>`;

  const newSecButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
          <div className="d-flex gap-2">
            <Button
              type="button"
              styleType="primary"
              disabled={saving || isDiscarding}
              onClick={() => void handleSaveWithStatus(ArtifactStatus.PendingReview)}
            >
              {saving && saveTargetStatus === ArtifactStatus.PendingReview ? "Enviando..." : "Enviar a revisión"}
            </Button>
            <Button
              type="button"
              styleType="secondary"
              disabled={saving || isDiscarding}
              onClick={() => void handleSaveWithStatus(ArtifactStatus.Draft)}
            >
              {saving && saveTargetStatus === ArtifactStatus.Draft ? "Guardando..." : "Guardar borrador"}
            </Button>
            {canDiscard && (
              <Button
                type="button"
                styleType="link-danger"
                disabled={saving || isDiscarding}
                onClick={handleDiscardDraft}
              >
                {isDiscarding ? "Descartando..." : "Descartar borrador"}
              </Button>
            )}
          </div>
          <Button
            type="button"
            styleType="link-warning"
            onClick={handleClose}
            disabled={saving || isDiscarding}
          >
            Cancelar
          </Button>
        </div>`;

  secCode = secCode.replace(oldSecButtons.replace(/\r\n/g, '\n'), newSecButtons);
  secCode = secCode.replace(oldSecButtons, newSecButtons);

  secCode = secCode.replace(
    '<form onSubmit={handleFormSubmit}>',
    '<form onSubmit={(e) => { e.preventDefault(); void executeSave(saveTargetStatus); }}>'
  );

  fs.writeFileSync(sectionFormPath, secCode, 'utf8');
  console.log('FormSection.tsx buttons standardized');
}

// ==========================================
// 6. FormEvent.tsx: standardize buttons
// ==========================================
const eventFormPath = `${baseFront}/src/modules/EventEditor/components/FormEvent.tsx`;
let evCode = fs.readFileSync(eventFormPath, 'utf8');

if (!evCode.includes('saveTargetStatus')) {
  evCode = evCode.replace(
    'const [saving, setSaving] = useState(false);',
    'const [saving, setSaving] = useState(false);\r\n  const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);'
  );

  evCode = evCode.replace(
    'const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {',
    `const handleSaveWithStatus = async (targetStatus: ArtifactStatus) => {
    setSaveTargetStatus(targetStatus);
    await executeSave(targetStatus);
  };

  const executeSave = async (targetStatus: ArtifactStatus) => {`
  );

  evCode = evCode.replace(
    /status:\s*isAdmin \|\| isReviewer\s*\?\s*ArtifactStatus\.Available\s*:\s*ArtifactStatus\.PendingReview,/,
    'status: targetStatus,'
  );

  const oldEvButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
          <div className="d-flex gap-2">
            <Button
              type="submit"
              styleType="primary"
              disabled={saving || isDiscarding}
            >
              {submitLabel}
            </Button>
            {canDiscard && (
              <Button
                type="button"
                styleType="link-danger"
                onClick={handleDiscardDraft}
                disabled={saving || isDiscarding}
              >
                {isDiscarding ? "Descartando..." : "Descartar borrador"}
              </Button>
            )}
          </div>
          <Button
            type="button"
            styleType="link-warning"
            onClick={handleClose}
            disabled={saving || isDiscarding}
          >
            Cancelar
          </Button>
        </div>`;

  const newEvButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
          <div className="d-flex gap-2">
            <Button
              type="button"
              styleType="primary"
              disabled={saving || isDiscarding}
              onClick={() => void handleSaveWithStatus(ArtifactStatus.PendingReview)}
            >
              {saving && saveTargetStatus === ArtifactStatus.PendingReview ? "Enviando..." : "Enviar a revisión"}
            </Button>
            <Button
              type="button"
              styleType="secondary"
              disabled={saving || isDiscarding}
              onClick={() => void handleSaveWithStatus(ArtifactStatus.Draft)}
            >
              {saving && saveTargetStatus === ArtifactStatus.Draft ? "Guardando..." : "Guardar borrador"}
            </Button>
            {canDiscard && (
              <Button
                type="button"
                styleType="link-danger"
                onClick={handleDiscardDraft}
                disabled={saving || isDiscarding}
              >
                {isDiscarding ? "Descartando..." : "Descartar borrador"}
              </Button>
            )}
          </div>
          <Button
            type="button"
            styleType="link-warning"
            onClick={handleClose}
            disabled={saving || isDiscarding}
          >
            Cancelar
          </Button>
        </div>`;

  evCode = evCode.replace(oldEvButtons.replace(/\r\n/g, '\n'), newEvButtons);
  evCode = evCode.replace(oldEvButtons, newEvButtons);

  evCode = evCode.replace(
    '<form onSubmit={handleFormSubmit}>',
    '<form onSubmit={(e) => { e.preventDefault(); void executeSave(saveTargetStatus); }}>'
  );

  fs.writeFileSync(eventFormPath, evCode, 'utf8');
  console.log('FormEvent.tsx buttons standardized');
}

// ==========================================
// 7. FormCatalog.tsx: standardize buttons & status
// ==========================================
const catalogFormPath = `${baseFront}/src/modules/CatalogEditor/components/FormCatalog.tsx`;
let catCode = fs.readFileSync(catalogFormPath, 'utf8');

if (!catCode.includes('saveTargetStatus')) {
  catCode = catCode.replace(
    'const [saving, setSaving] = useState(false);',
    'const [saving, setSaving] = useState(false);\r\n  const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);'
  );

  catCode = catCode.replace(
    'const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {',
    `const handleSaveWithStatus = async (targetStatus: ArtifactStatus) => {
    setSaveTargetStatus(targetStatus);
    await executeSave(targetStatus);
  };

  const executeSave = async (targetStatus: ArtifactStatus) => {`
  );

  catCode = catCode.replace(
    /status:\s*isAdmin \|\| isReviewer \? form\.status : ArtifactStatus\.PendingReview,/,
    'status: targetStatus,'
  );

  // In createCodelistWithCsv / importCodelistCsv: pass status
  catCode = catCode.replace(
    'author: normalizedAuthor,',
    'author: normalizedAuthor,\r\n          status: targetStatus,'
  );

  const oldCatButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
            <div className="d-flex gap-2">
              <Button
                type="submit"
                styleType="primary"
                disabled={saving || csvImporting || isDiscarding}
              >
                {submitLabel}
              </Button>
              {canDiscard && (
                <Button
                  type="button"
                  styleType="link-danger"
                  disabled={saving || csvImporting || isDiscarding}
                  onClick={handleDiscardDraft}
                >
                  {isDiscarding ? "Descartando..." : "Descartar borrador"}
                </Button>
              )}
            </div>
            <Button
              type="button"
              styleType="link-warning"
              disabled={saving || csvImporting || isDiscarding}
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>`;

  const newCatButtons = `<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap pt-2">
            <div className="d-flex gap-2">
              <Button
                type="button"
                styleType="primary"
                disabled={saving || csvImporting || isDiscarding}
                onClick={() => void handleSaveWithStatus(ArtifactStatus.PendingReview)}
              >
                {saving && saveTargetStatus === ArtifactStatus.PendingReview ? "Enviando..." : "Enviar a revisión"}
              </Button>
              <Button
                type="button"
                styleType="secondary"
                disabled={saving || csvImporting || isDiscarding}
                onClick={() => void handleSaveWithStatus(ArtifactStatus.Draft)}
              >
                {saving && saveTargetStatus === ArtifactStatus.Draft ? "Guardando..." : "Guardar borrador"}
              </Button>
              {canDiscard && (
                <Button
                  type="button"
                  styleType="link-danger"
                  disabled={saving || csvImporting || isDiscarding}
                  onClick={handleDiscardDraft}
                >
                  {isDiscarding ? "Descartando..." : "Descartar borrador"}
                </Button>
              )}
            </div>
            <Button
              type="button"
              styleType="link-warning"
              disabled={saving || csvImporting || isDiscarding}
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>`;

  catCode = catCode.replace(oldCatButtons.replace(/\r\n/g, '\n'), newCatButtons);
  catCode = catCode.replace(oldCatButtons, newCatButtons);

  catCode = catCode.replace(
    '<form onSubmit={handleSubmit}>',
    '<form onSubmit={(e) => { e.preventDefault(); void executeSave(saveTargetStatus); }}>'
  );

  fs.writeFileSync(catalogFormPath, catCode, 'utf8');
  console.log('FormCatalog.tsx buttons standardized');
}

// ==========================================
// 8. FormBanner.tsx: standardize buttons & status
// ==========================================
const bannerFormPath = `${baseFront}/src/modules/BannerEditor/components/FormBanner.tsx`;
let banCode = fs.readFileSync(bannerFormPath, 'utf8');

if (!banCode.includes('saveTargetStatus')) {
  banCode = banCode.replace(
    'const [saving, setSaving] = useState(false);',
    'const [saving, setSaving] = useState(false);\r\n  const [saveTargetStatus, setSaveTargetStatus] = useState<string>("PendingReview");'
  );

  banCode = banCode.replace(
    'const handleSubmit = async (e: React.FormEvent) => {\r\n    e.preventDefault();',
    `const handleSaveWithStatus = async (targetStatus: string) => {
    setSaveTargetStatus(targetStatus);
    await executeSave(targetStatus);
  };

  const executeSave = async (targetStatus: string) => {`
  );
  banCode = banCode.replace(
    'const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();',
    `const handleSaveWithStatus = async (targetStatus: string) => {
    setSaveTargetStatus(targetStatus);
    await executeSave(targetStatus);
  };

  const executeSave = async (targetStatus: string) => {`
  );

  banCode = banCode.replace(
    'posicion: "relative",',
    'posicion: "relative",\r\n        status: targetStatus as any,'
  );

  const oldBanButtons = `<div className="d-flex justify-content-between align-items-center w-100 pt-3 border-top">
        <div className="d-flex gap-2">
          <Button
            styleType="primary"
            type="submit"
            disabled={saving || isDiscarding}
          >
            {saving
              ? isEditing
                ? "Actualizando..."
                : "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Guardar"}
          </Button>
          {isProposal && (
            <Button
              styleType="link-danger"
              type="button"
              onClick={() => void handleDiscard()}
              disabled={saving || isDiscarding}
            >
              {isDiscarding ? "Descartando..." : "Descartar borrador"}
            </Button>
          )}
        </div>
        <Button
          styleType="link-warning"
          type="button"
          onClick={onClose}
          disabled={saving || isDiscarding}
        >
          Cancelar
        </Button>
      </div>`;

  const newBanButtons = `<div className="d-flex justify-content-between align-items-center w-100 pt-3 border-top">
        <div className="d-flex gap-2">
          <Button
            styleType="primary"
            type="button"
            disabled={saving || isDiscarding}
            onClick={() => void handleSaveWithStatus("PendingReview")}
          >
            {saving && saveTargetStatus === "PendingReview" ? "Enviando..." : "Enviar a revisión"}
          </Button>
          <Button
            styleType="secondary"
            type="button"
            disabled={saving || isDiscarding}
            onClick={() => void handleSaveWithStatus("Draft")}
          >
            {saving && saveTargetStatus === "Draft" ? "Guardando..." : "Guardar borrador"}
          </Button>
          {isProposal && (
            <Button
              styleType="link-danger"
              type="button"
              onClick={() => void handleDiscard()}
              disabled={saving || isDiscarding}
            >
              {isDiscarding ? "Descartando..." : "Descartar borrador"}
            </Button>
          )}
        </div>
        <Button
          styleType="link-warning"
          type="button"
          onClick={onClose}
          disabled={saving || isDiscarding}
        >
          Cancelar
        </Button>
      </div>`;

  banCode = banCode.replace(oldBanButtons.replace(/\r\n/g, '\n'), newBanButtons);
  banCode = banCode.replace(oldBanButtons, newBanButtons);

  banCode = banCode.replace(
    '<form onSubmit={handleSubmit} className="p-3">',
    '<form onSubmit={(e) => { e.preventDefault(); void executeSave(saveTargetStatus); }} className="p-3">'
  );

  fs.writeFileSync(bannerFormPath, banCode, 'utf8');
  console.log('FormBanner.tsx buttons standardized');
}

