import { NextFunction, Request, Response, Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth";
import { canManageMasterData } from "../policies/permitPolicy";
import { forbidden } from "../utils/errors";
import * as auth from "../controllers/authController";
import * as permit from "../controllers/permitController";
import * as ref from "../controllers/referenceController";
import * as admin from "../controllers/adminController";

const h = asyncHandler;
export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.post("/auth/login", h(auth.login));

// Everything below needs a valid token.
router.use(authenticate);
router.get("/auth/me", h(auth.me));

router.get("/permits", h(permit.list));
router.get("/permits/stats", h(permit.stats));
router.post("/permits", h(permit.create));
router.get("/permits/:id", h(permit.get));
router.patch("/permits/:id", h(permit.update));
router.get("/permits/:id/audit", h(permit.audit));
router.get("/permits/:id/work-logs", h(permit.listWorkLogs));
router.post("/permits/:id/work-logs", h(permit.addWorkLog));
router.post("/permits/:id/submit", h(permit.submit));
router.post("/permits/:id/approve", h(permit.approve));
router.post("/permits/:id/reject", h(permit.reject));
router.post("/permits/:id/activate", h(permit.activate));
router.post("/permits/:id/suspend", h(permit.suspend));
router.post("/permits/:id/resume", h(permit.resume));
router.post("/permits/:id/complete", h(permit.complete));
router.post("/permits/:id/verify-closure", h(permit.verify));
router.post("/permits/:id/cancel", h(permit.cancel));

router.get("/reference/locations", h(ref.plantsAreasEquipment));
router.get("/reference/catalog", ref.catalog);
router.get("/reference/approver-preview", h(ref.approverPreview));
router.get("/reference/users", h(ref.approverUsers));

const adminOnly = (req: Request, _res: Response, next: NextFunction) => {
  const verdict = canManageMasterData(req.user!);
  next(verdict ? forbidden(verdict) : undefined);
};
router.use("/admin", adminOnly);
router.get("/admin/users", h(admin.listUsers));
router.post("/admin/users", h(admin.createUser));
router.patch("/admin/users/:id", h(admin.updateUser));
router.post("/admin/plants", h(admin.createPlant));
router.post("/admin/areas", h(admin.createArea));
router.post("/admin/equipment", h(admin.createEquipment));
router.patch("/admin/equipment/:id", h(admin.updateEquipment));
