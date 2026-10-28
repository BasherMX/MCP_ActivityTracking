import fs from 'node:fs';

const baseFront = 'd:/TRABAJO/DCMTIC/FRONT/comunidadinformatica.administrador';

// ==========================================
// 1. Approvals.service.ts: add submitForReview alias to approvalsService
// ==========================================
const approvalsServicePath = `${baseFront}/src/modules/Approvals/services/Approvals.service.ts`;
let apr = fs.readFileSync(approvalsServicePath, 'utf8');
if (!apr.includes('submitForReview:')) {
  apr = apr.replace(
    'submit: (',
    'submitForReview: (\r\n    componentId: number,\r\n    entityType: string = "Component",\r\n    payload?: IApprovalActionPayload,\r\n  ): Promise<IApprovalRequest> =>\r\n    defaultApprovalsService.submitForReview(componentId, payload, entityType),\r\n  submit: ('
  );
  fs.writeFileSync(approvalsServicePath, apr, 'utf8');
  console.log('submitForReview added to approvalsService');
}

// ==========================================
// 2. FormCatalog.tsx
// ==========================================
const catPath = `${baseFront}/src/modules/CatalogEditor/components/FormCatalog.tsx`;
let cat = fs.readFileSync(catPath, 'utf8');

// remove unused saveTargetStatus state if present
cat = cat.replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\r\n',
  ''
).replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\n',
  ''
);

// fix handleSave signature and remove invalid status parameter from isCatalogSaveValid
cat = cat.replace(
  'const handleSave = async () => {',
  'const handleSave = async (targetStatus: ArtifactStatus = ArtifactStatus.PendingReview) => {'
);
cat = cat.replace(
  'status: targetStatus,',
  ''
);

// replace bottom buttons
const oldCatButtons = `<Button
            type="button"
            onClick={handleSave}
            disabled={saving || csvImporting || isDiscarding}
            className="px-4"
            styleType="primary"
          >
            {saving || csvImporting
              ? id
                ? "Actualizando..."
                : "Guardando..."
              : id
                ? "Publicar versión"
                : "Publicar catálogo"}
          </Button>`;

const newCatButtons = `<Button
            type="button"
            className="px-4"
            styleType="primary"
            disabled={saving || csvImporting || isDiscarding}
            onClick={() => void handleSave(ArtifactStatus.PendingReview)}
          >
            {saving || csvImporting ? "Enviando..." : "Enviar a revisión"}
          </Button>
          <Button
            type="button"
            className="px-4"
            styleType="secondary"
            disabled={saving || csvImporting || isDiscarding}
            onClick={() => void handleSave(ArtifactStatus.Draft)}
          >
            {saving || csvImporting ? "Guardando..." : "Guardar borrador"}
          </Button>`;

cat = cat.replace(oldCatButtons.replace(/\r\n/g, '\n'), newCatButtons);
cat = cat.replace(oldCatButtons, newCatButtons);

fs.writeFileSync(catPath, cat, 'utf8');
console.log('FormCatalog.tsx fixed');

// ==========================================
// 3. FormEvent.tsx
// ==========================================
const evPath = `${baseFront}/src/modules/EventEditor/components/FormEvent.tsx`;
let ev = fs.readFileSync(evPath, 'utf8');

ev = ev.replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\r\n',
  ''
).replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\n',
  ''
);

// handleFormSubmit accepts targetStatus
ev = ev.replace(
  'const handleFormSubmit = async (\r\n    event: React.FormEvent<HTMLFormElement>,\r\n  ) => {\r\n    event.preventDefault();',
  'const handleFormSubmit = async (\r\n    targetStatus: ArtifactStatus = ArtifactStatus.PendingReview,\r\n  ) => {'
).replace(
  'const handleFormSubmit = async (\n    event: React.FormEvent<HTMLFormElement>,\n  ) => {\n    event.preventDefault();',
  'const handleFormSubmit = async (\n    targetStatus: ArtifactStatus = ArtifactStatus.PendingReview,\n  ) => {'
);

const oldEvButtons = `<div className="d-flex gap-2">
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
          </div>`;

const newEvButtons = `<div className="d-flex gap-2">
            <Button
              type="button"
              styleType="primary"
              disabled={saving || isDiscarding}
              onClick={() => void handleFormSubmit(ArtifactStatus.PendingReview)}
            >
              {saving ? "Enviando..." : "Enviar a revisión"}
            </Button>
            <Button
              type="button"
              styleType="secondary"
              disabled={saving || isDiscarding}
              onClick={() => void handleFormSubmit(ArtifactStatus.Draft)}
            >
              {saving ? "Guardando..." : "Guardar borrador"}
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
          </div>`;

ev = ev.replace(oldEvButtons.replace(/\r\n/g, '\n'), newEvButtons);
ev = ev.replace(oldEvButtons, newEvButtons);

ev = ev.replace(
  '<form onSubmit={handleFormSubmit}>',
  '<form onSubmit={(e) => { e.preventDefault(); void handleFormSubmit(ArtifactStatus.PendingReview); }}>'
);

fs.writeFileSync(evPath, ev, 'utf8');
console.log('FormEvent.tsx fixed');

// ==========================================
// 4. FormSection.tsx
// ==========================================
const secPath = `${baseFront}/src/modules/SectionEditor/components/FormSection.tsx`;
let sec = fs.readFileSync(secPath, 'utf8');

sec = sec.replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\r\n',
  ''
).replace(
  'const [saveTargetStatus, setSaveTargetStatus] = useState<ArtifactStatus>(ArtifactStatus.PendingReview);\n',
  ''
);

sec = sec.replace(
  'const handleSaveWithStatus = async (targetStatus: ArtifactStatus) => {\r\n    setSaveTargetStatus(targetStatus);\r\n    await executeSave(targetStatus);\r\n  };\r\n\r\n  const executeSave = async (targetStatus: ArtifactStatus) => {\r\n    event.preventDefault();',
  'const handleFormSubmit = async (targetStatus: ArtifactStatus = ArtifactStatus.PendingReview) => {'
).replace(
  'const handleSaveWithStatus = async (targetStatus: ArtifactStatus) => {\n    setSaveTargetStatus(targetStatus);\n    await executeSave(targetStatus);\n  };\n\n  const executeSave = async (targetStatus: ArtifactStatus) => {\n    event.preventDefault();',
  'const handleFormSubmit = async (targetStatus: ArtifactStatus = ArtifactStatus.PendingReview) => {'
);

sec = sec.replace(
  'onClick={() => void handleSaveWithStatus(ArtifactStatus.PendingReview)}',
  'onClick={() => void handleFormSubmit(ArtifactStatus.PendingReview)}'
);
sec = sec.replace(
  'onClick={() => void handleSaveWithStatus(ArtifactStatus.Draft)}',
  'onClick={() => void handleFormSubmit(ArtifactStatus.Draft)}'
);
sec = sec.replace(
  'saving && saveTargetStatus === ArtifactStatus.PendingReview ? "Enviando..." : "Enviar a revisión"',
  'saving ? "Enviando..." : "Enviar a revisión"'
);
sec = sec.replace(
  'saving && saveTargetStatus === ArtifactStatus.Draft ? "Guardando..." : "Guardar borrador"',
  'saving ? "Guardando..." : "Guardar borrador"'
);

sec = sec.replace(
  '<form onSubmit={handleFormSubmit} className="d-flex flex-column gap-3">',
  '<form onSubmit={(e) => { e.preventDefault(); void handleFormSubmit(ArtifactStatus.PendingReview); }} className="d-flex flex-column gap-3">'
);

fs.writeFileSync(secPath, sec, 'utf8');
console.log('FormSection.tsx fixed');

// ==========================================
// 5. FormBanner.tsx
// ==========================================
const banPath = `${baseFront}/src/modules/BannerEditor/components/FormBanner.tsx`;
let ban = fs.readFileSync(banPath, 'utf8');

const oldBanBtnBlock = `<div className="d-flex justify-content-between align-items-center w-100 pt-3 border-top">
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

const newBanBtnBlock = `<div className="d-flex justify-content-between align-items-center w-100 pt-3 border-top">
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

ban = ban.replace(oldBanBtnBlock.replace(/\r\n/g, '\n'), newBanBtnBlock);
ban = ban.replace(oldBanBtnBlock, newBanBtnBlock);

fs.writeFileSync(banPath, ban, 'utf8');
console.log('FormBanner.tsx fixed');

// ==========================================
// 6. ListGlosario.tsx: clean unused variables and fix button click
// ==========================================
const gloPath = `${baseFront}/src/modules/Glosario/components/ListGlosario.tsx`;
let glo = fs.readFileSync(gloPath, 'utf8');

glo = glo.replace('canSubmitConcept,', '');
glo = glo.replace('const canSendForReview = isAdmin || isReviewer;\r\n', '');
glo = glo.replace('const canSendForReview = isAdmin || isReviewer;\n', '');

fs.writeFileSync(gloPath, glo, 'utf8');
console.log('ListGlosario.tsx fixed');

