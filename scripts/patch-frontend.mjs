import fs from 'node:fs';

const baseFront = 'd:/TRABAJO/DCMTIC/FRONT/comunidadinformatica.administrador';

// ==========================================
// 1. Fix text -> message in ReactSweetAlert.modal across files
// ==========================================
const modalFiles = [
  `${baseFront}/src/modules/BannerEditor/components/FormBanner.tsx`,
  `${baseFront}/src/modules/CatalogEditor/components/FormCatalog.tsx`,
  `${baseFront}/src/modules/ComponentEditor/properties/PropertyEditor.tsx`,
  `${baseFront}/src/modules/EventEditor/components/FormEvent.tsx`,
  `${baseFront}/src/modules/Glosario/components/ListGlosario.tsx`,
  `${baseFront}/src/modules/SectionEditor/components/FormSection.tsx`,
];

modalFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /title:\s*"¿Descartar propuesta\?",\r?\n\s*text:/g,
      'title: "¿Descartar propuesta?",\r\n      message:'
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed modal message in ${file}`);
  }
});

// ==========================================
// 2. ApprovalsTable.tsx
// ==========================================
const approvalsTablePath = `${baseFront}/src/modules/Approvals/components/ApprovalsTable.tsx`;
let atCode = fs.readFileSync(approvalsTablePath, 'utf8');

// Add getContentTypeIcon
if (!atCode.includes('getContentTypeIcon')) {
  const iconHelper = `export const getContentTypeIcon = (item: IApprovalRequest): string => {
  const entity = (item.entityType || "").trim().toLowerCase();
  const comp = (item.componentType || item.type || "").trim().toLowerCase();

  if (entity === "event" || comp.includes("event") || comp.includes("calendar")) return "mdiCalendar";
  if (entity === "catalog" || comp.includes("catalog") || comp.includes("codelist")) return "mdiDatabase";
  if (entity === "concept" || entity === "glossary" || comp.includes("concept") || comp.includes("glossary")) return "mdiBookOpenVariant";
  if (entity === "aviso" || comp.includes("aviso")) return "mdiBullhornOutline";
  if (entity === "sectionlayout" || comp.includes("layout") || comp.includes("section")) return "mdiViewDashboardOutline";
  if (comp.includes("doc") || comp.includes("file") || comp.includes("document")) return "mdiFileDocumentOutline";
  if (comp.includes("banner") || comp.includes("image") || comp.includes("carousel")) return "mdiImageOutline";
  if (comp.includes("link") || comp.includes("url")) return "mdiLinkVariant";
  return "mdiWidgetsOutline";
};

`;
  atCode = atCode.replace('export const sanitizeUserDisplay =', `${iconHelper}export const sanitizeUserDisplay =`);
}

// Update columns in ApprovalsTable
const oldColumnsPattern = /const columns: IColumn<IApprovalRequest>\[\] = useMemo\([\s\S]*?\n\s*\),\r?\n\s*\[canDecide, onReview, onDiscard\],\r?\n\s*\);/;

const newColumnsCode = `const columns: IColumn<IApprovalRequest>[] = useMemo(
    () => [
      {
        id: "elementTitle",
        name: "Elemento / Título",
        width: "28%",
        data: (item) =>
          item.title || item.componentKey || formatElementTypeLabel(item),
        formatter: (item) => {
          const rawTitle = item.title || item.componentKey || "Elemento editorial";
          const isEvent = (item.entityType || "").toLowerCase() === "event" || (item.type || "").toLowerCase() === "event";
          const subtitle = isEvent ? null : (item.subtitle || item.description);
          const showSubtitle =
            subtitle &&
            subtitle.trim().toLowerCase() !== rawTitle.trim().toLowerCase() &&
            subtitle.trim().toLowerCase() !== (item.componentKey || "").trim().toLowerCase();

          return (
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon path={getContentTypeIcon(item)} size={0.8} color="primary" />
                <span className="fw-bold text-dark">{rawTitle}</span>
              </div>
              {showSubtitle && (
                <small className="text-muted d-block text-truncate">
                  {subtitle}
                </small>
              )}
              {item.fileName && (
                <small className="text-secondary d-block">
                  Archivo: {item.fileName}
                </small>
              )}
            </div>
          );
        },
      },
      {
        id: "location",
        name: "Ubicación",
        width: "16%",
        data: (item) => item.sectionName || item.pageName || item.moduleName || "Portal General",
        formatter: (item) => {
          const leaf = item.sectionName || item.pageName || item.moduleName || "Portal General";
          return <span className="small text-dark">{leaf}</span>;
        },
      },
      {
        id: "submittedBy",
        name: "Enviado por",
        width: "16%",
        data: (item) =>
          sanitizeUserDisplay(item.submittedByUserName) ||
          sanitizeUserDisplay(item.authorResponsable) ||
          "Editor asignado",
        formatter: (item) => {
          if (item.historyAction) {
            return (
              <span className="small text-muted">
                Dictaminado por: {sanitizeUserDisplay(item.reviewerUserName) || "Revisor asignado"}
              </span>
            );
          }
          const submittedBy =
            sanitizeUserDisplay(item.submittedByUserName) ||
            sanitizeUserDisplay(item.authorResponsable) ||
            "Editor asignado";
          return (
            <span className="small text-dark text-truncate">
              {submittedBy}
            </span>
          );
        },
      },
      {
        id: "version",
        name: "Versión",
        width: "6%",
        data: (item) => \`v\${item.currentVersion ?? 1}\`,
        formatter: (item) => (
          <span className="small text-muted fw-semibold">
            v{item.currentVersion ?? 1}
          </span>
        ),
      },
      {
        id: "status",
        name: "Estado",
        width: "16%",
        data: (item) => item.status,
        formatter: (item) => getApprovalStatusBadge(item.status),
      },
      {
        id: "submittedAt",
        name: "Fecha envío",
        width: "10%",
        data: (item) => item.reviewedAt || item.submittedAt || "",
        formatter: (item) => (
          <span className="small text-muted">
            {item.reviewedAt || item.submittedAt
              ? new Date((item.reviewedAt || item.submittedAt)!).toLocaleDateString("es-MX")
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        name: "Acciones",
        width: "8%",
        formatter: (item) => {
          const canDiscardItem =
            (item.status === "Draft" ||
              item.status === "Rejected" ||
              item.status === "ChangesRequested") &&
            item.canDiscard !== false;

          return (
            <div className="d-flex align-items-center justify-content-center gap-2">
              <Tooltip
                text={getApprovalReviewTooltip(canDecide && !item.historyAction)}
                position="top"
                tooltipColor="secondary"
              >
                <span className="cursor-pointer">
                  <Icon
                    path="mdiFileEyeOutline"
                    size={0.85}
                    color="secondary"
                    onClick={() => onReview(item)}
                  />
                </span>
              </Tooltip>

              {canDiscardItem && onDiscard && (
                <Tooltip
                  text="Descartar borrador"
                  position="top"
                  tooltipColor="secondary"
                >
                  <span className="cursor-pointer">
                    <Icon
                      path="mdiTrashCanOutline"
                      size={0.85}
                      color="danger"
                      onClick={() => onDiscard(item)}
                    />
                  </span>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [canDecide, onReview, onDiscard],
  );`;

atCode = atCode.replace(oldColumnsPattern, newColumnsCode);
fs.writeFileSync(approvalsTablePath, atCode, 'utf8');
console.log('ApprovalsTable.tsx updated');

// ==========================================
// 3. ListEvents.tsx
// ==========================================
const listEventsPath = `${baseFront}/src/modules/EventEditor/components/ListEvents.tsx`;
let leCode = fs.readFileSync(listEventsPath, 'utf8');

// Replace columns in ListEvents.tsx
const oldEventColumnsPattern = /const columns = useMemo<IColumn<EventRow>\[\]>\([\s\S]*?\n\s*\),\r?\n\s*\[modules, onToggleFeatured, onToggleStatus, openDeleteModal, openEditModal\],\r?\n\s*\);/;

const newEventColumnsCode = `const columns = useMemo<IColumn<EventRow>[]>(
    () => [
      {
        id: "id",
        name: "ID",
        width: "5%",
        data: (row) => row.id,
      },
      {
        id: "name",
        name: "Nombre",
        width: "22%",
        data: (row) => row.name ?? "—",
        formatter: (row) => (
          <div className="d-flex flex-column">
            <span>{row.name ?? "—"}</span>
            {row.status === ArtifactStatus.PendingReview && (
              <small className="text-muted">Versión en revisión</small>
            )}
          </div>
        ),
      },
      {
        id: "type",
        name: "Tipo",
        width: "13%",
        data: (row) => getEventTypeLabel(row.type),
      },
      {
        id: "startDate",
        name: "Inicio",
        width: "10%",
        data: (row) => row.startDate ?? "—",
        sort: {
          enabled: true,
          compare: compareDates,
        },
        formatter: (row) => (
          <span>
            {row.startDate
              ? new Date(row.startDate).toLocaleDateString("es-MX")
              : "—"}
          </span>
        ),
      },
      {
        id: "endDate",
        name: "Fin",
        width: "10%",
        data: (row) => row.endDate ?? "—",
        sort: {
          enabled: true,
          compare: compareDates,
        },
        formatter: (row) => (
          <span>
            {row.endDate
              ? new Date(row.endDate).toLocaleDateString("es-MX")
              : "—"}
          </span>
        ),
      },
      {
        id: "eventStatus",
        name: "Estatus del evento",
        width: "14%",
        data: (row) => getEventStatusInfo(row.startDate, row.endDate).label,
        sort: {
          enabled: true,
          compare: (a, b) => {
            const rankA = getStatusRank(String(a ?? ""));
            const rankB = getStatusRank(String(b ?? ""));
            return rankA - rankB;
          },
        },
        formatter: (row) => {
          const statusInfo = getEventStatusInfo(row.startDate, row.endDate);
          return (
            <Badge styleType={statusInfo.styleType}>
              {statusInfo.label}
            </Badge>
          );
        },
      },
      {
        id: "status",
        name: "Estado",
        width: "12%",
        data: (row) => row.status ?? ArtifactStatus.Available,
        formatter: (row) => (
          <div className="d-flex flex-column align-items-start gap-1">
            {getApprovalStatusBadge(row.status ?? ArtifactStatus.Available)}
            <small className="text-muted">
              v{row.version ?? 1}
            </small>
          </div>
        ),
      },
      {
        id: "clickNumber",
        name: "Clics",
        width: "5%",
        data: (row) => row.clickNumber ?? 0,
        sort: {
          enabled: true,
        },
        formatter: (row) => (
          <span className="fw-semibold text-secondary">
            {row.clickNumber ?? 0}
          </span>
        ),
      },
      {
        id: "actions",
        name: "Acciones",
        width: "9%",
        formatter: (row) => (
          <div className="d-flex gap-2">
            <Tooltip
              text={row.isFeatured ? "Desmarcar destacado" : "Marcar destacado"}
              position="top"
              tooltipColor="primary"
            >
              <Icon
                path={row.isFeatured ? "mdiStar" : "mdiStarOutline"}
                size={0.8}
                color={row.isFeatured ? "warning" : "secondary"}
                className="cursor-pointer"
                onClick={() => onToggleFeatured(row)}
              />
            </Tooltip>
            <Tooltip
              text={
                row.isActive ? "Desactivar evento" : "Activar evento"
              }
              position="top"
              tooltipColor="primary"
            >
              <Icon
                path={row.isActive ? "mdiEye" : "mdiEyeOff"}
                size={0.8}
                color={row.isActive ? "primary" : "secondary"}
                className="cursor-pointer"
                onClick={() => onToggleStatus(row)}
              />
            </Tooltip>
            <Tooltip text="Editar evento" position="top" tooltipColor="primary">
              <Icon
                path="mdiSquareEditOutline"
                size={0.8}
                color="primary"
                className="cursor-pointer"
                onClick={() => openEditModal(row)}
              />
            </Tooltip>
            <Tooltip
              text="Eliminar evento"
              position="top"
              tooltipColor="primary"
            >
              <Icon
                path="mdiTrashCanOutline"
                size={0.8}
                color="danger"
                className="cursor-pointer"
                onClick={() => openDeleteModal(row)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [modules, onToggleFeatured, onToggleStatus, openDeleteModal, openEditModal],
  );`;

leCode = leCode.replace(oldEventColumnsPattern, newEventColumnsCode);
fs.writeFileSync(listEventsPath, leCode, 'utf8');
console.log('ListEvents.tsx updated');

// ==========================================
// 4. ListGlosario.tsx
// ==========================================
const listGlosarioPath = `${baseFront}/src/modules/Glosario/components/ListGlosario.tsx`;
let lgCode = fs.readFileSync(listGlosarioPath, 'utf8');

// Remove help small texts
lgCode = lgCode.replace(
  '<small className="text-muted">Primera letra mayúscula; se conserva el resto del texto.</small>',
  ''
);
lgCode = lgCode.replace(
  '<small className="text-muted">Primera letra minúscula; se conservan acrónimos y el resto del texto.</small>',
  ''
);

// Remove helper paragraph in header
lgCode = lgCode.replace(
  /<p className="text-muted small mb-0">\r?\n\s*Borrador → revisión → aprobación y publicación, o rechazo con motivo para corregir\.\r?\n\s*<\/p>/,
  ''
);

// Rename column "Estatus editorial" to "Estatus"
lgCode = lgCode.replace(
  'name: "Estatus editorial",',
  'name: "Estatus",'
);

// Remove "Enviar a revisión" and "Ver revisión editorial" buttons from table actions
const actionButtonsPattern = /\{canSendForReview && canSubmitConcept\(target\) && \([\s\S]*?<\/Tooltip>\r?\n\s*\)\}\r?\n\s*\{\(approvalsById\.has\(target\.id\) \|\| getConceptStatus\(target\) === ArtifactStatus\.Rejected\) && \([\s\S]*?<\/Tooltip>\r?\n\s*\)\}/;
lgCode = lgCode.replace(actionButtonsPattern, '');

// Ensure default responsible is "POR DEFINIR" and users[0] doesn't overwrite it
lgCode = lgCode.replace(
  /createEmptyForm\(\r?\n\s*users\[0\]\?\.id \?\? 0,\r?\n\s*users\[0\]\?\.name \?\? users\[0\]\?\.email \?\? "",\r?\n\s*\)/g,
  'createEmptyForm(0, "POR DEFINIR")'
);

lgCode = lgCode.replace(
  /if \(form\.responsableID === 0 && users\.length > 0\) \{[\s\S]*?responsable: users\[0\]\.name[\s\S]*?\}\);[\s\S]*?\}/,
  '// Mantiene POR DEFINIR como responsable por defecto\r\n    if (!form.responsable) {\r\n      setForm(c => ({ ...c, responsable: "POR DEFINIR" }));\r\n    }'
);

fs.writeFileSync(listGlosarioPath, lgCode, 'utf8');
console.log('ListGlosario.tsx updated');

// ==========================================
// 5. Approvals.service.ts optimization
// ==========================================
const approvalsServicePath = `${baseFront}/src/modules/Approvals/services/Approvals.service.ts`;
let asFront = fs.readFileSync(approvalsServicePath, 'utf8');

asFront = asFront.replace(
  'public async getPendingApprovals(): Promise<IApprovalRequest[]> {\r\n    const response = await this.apiClient.get<IApprovalRequest[]>(\r\n      "/admin/approvals/pending",\r\n    );',
  'public async getPendingApprovals(entityType?: string): Promise<IApprovalRequest[]> {\r\n    const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";\r\n    const response = await this.apiClient.get<IApprovalRequest[]>(\r\n      `/admin/approvals/pending${query}`,\r\n    );'
);
asFront = asFront.replace(
  'public async getPendingApprovals(): Promise<IApprovalRequest[]> {\n    const response = await this.apiClient.get<IApprovalRequest[]>(\n      "/admin/approvals/pending",\n    );',
  'public async getPendingApprovals(entityType?: string): Promise<IApprovalRequest[]> {\n    const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";\n    const response = await this.apiClient.get<IApprovalRequest[]>(\n      `/admin/approvals/pending${query}`,\n    );'
);

asFront = asFront.replace(
  'public getPending(): Promise<IApprovalRequest[]> {\r\n    return this.getPendingApprovals();\r\n  }',
  'public getPending(entityType?: string): Promise<IApprovalRequest[]> {\r\n    return this.getPendingApprovals(entityType);\r\n  }'
);
asFront = asFront.replace(
  'public getPending(): Promise<IApprovalRequest[]> {\n    return this.getPendingApprovals();\n  }',
  'public getPending(entityType?: string): Promise<IApprovalRequest[]> {\n    return this.getPendingApprovals(entityType);\n  }'
);

fs.writeFileSync(approvalsServicePath, asFront, 'utf8');
console.log('Approvals.service.ts updated');

// ==========================================
// 6. Pass entityType filter in ListCatalogs, ListEvents, ListGlosario
// ==========================================
// ListCatalogs.tsx
const listCatalogsPath = `${baseFront}/src/modules/CatalogEditor/components/ListCatalogs.tsx`;
if (fs.existsSync(listCatalogsPath)) {
  let lc = fs.readFileSync(listCatalogsPath, 'utf8');
  lc = lc.replace('approvalsService.getPending()', 'approvalsService.getPending("Catalog")');
  fs.writeFileSync(listCatalogsPath, lc, 'utf8');
  console.log('ListCatalogs.tsx filtered by Catalog');
}

// ListEvents.tsx
leCode = fs.readFileSync(listEventsPath, 'utf8');
leCode = leCode.replace('approvalsService.getPending()', 'approvalsService.getPending("Event")');
fs.writeFileSync(listEventsPath, leCode, 'utf8');
console.log('ListEvents.tsx filtered by Event');

// ListGlosario.tsx
lgCode = fs.readFileSync(listGlosarioPath, 'utf8');
lgCode = lgCode.replace('approvalsService.getPending(),', 'approvalsService.getPending("Concept"),');
fs.writeFileSync(listGlosarioPath, lgCode, 'utf8');
console.log('ListGlosario.tsx filtered by Concept');

