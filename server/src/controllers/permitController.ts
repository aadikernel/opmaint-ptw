import { Request, Response } from "express";
import * as permits from "../services/permitService";
import * as workflow from "../services/workflowService";
import {
  commentSchema, completeSchema, createPermitSchema, listQuerySchema,
  reasonSchema, updatePermitSchema, verifySchema, workLogSchema,
} from "../validators/permit";

const id = (req: Request) => String(req.params.id);

export const list = async (req: Request, res: Response) => res.json({ permits: await permits.listPermits(req.user!, listQuerySchema.parse(req.query)) });
export const stats = async (req: Request, res: Response) => res.json(await permits.permitStats(req.user!));
export const get = async (req: Request, res: Response) => res.json({ permit: await permits.getPermit(req.user!, id(req)) });
export const create = async (req: Request, res: Response) => res.status(201).json({ permit: await permits.createPermit(req.user!, createPermitSchema.parse(req.body)) });
export const update = async (req: Request, res: Response) => res.json({ permit: await permits.updatePermit(req.user!, id(req), updatePermitSchema.parse(req.body)) });
export const audit = async (req: Request, res: Response) => res.json({ entries: await permits.listAudit(req.user!, id(req)) });

export const submit = async (req: Request, res: Response) => res.json({ permit: await workflow.submitPermit(req.user!, id(req)) });
export const approve = async (req: Request, res: Response) => res.json({ permit: await workflow.approvePermit(req.user!, id(req), commentSchema.parse(req.body ?? {}).comment) });
export const reject = async (req: Request, res: Response) => res.json({ permit: await workflow.rejectPermit(req.user!, id(req), reasonSchema.parse(req.body ?? {}).reason) });
export const activate = async (req: Request, res: Response) => res.json({ permit: await workflow.activatePermit(req.user!, id(req)) });
export const suspend = async (req: Request, res: Response) => res.json({ permit: await workflow.suspendPermit(req.user!, id(req), reasonSchema.parse(req.body ?? {}).reason) });
export const resume = async (req: Request, res: Response) => res.json({ permit: await workflow.resumePermit(req.user!, id(req), commentSchema.parse(req.body ?? {}).comment) });
export const complete = async (req: Request, res: Response) => res.json({ permit: await workflow.completePermit(req.user!, id(req), completeSchema.parse(req.body ?? {}).completionNotes) });
export const verify = async (req: Request, res: Response) => res.json({ permit: await workflow.verifyClosure(req.user!, id(req), verifySchema.parse(req.body ?? {})) });
export const cancel = async (req: Request, res: Response) => res.json({ permit: await workflow.cancelPermit(req.user!, id(req), reasonSchema.parse(req.body ?? {}).reason) });

export const addWorkLog = async (req: Request, res: Response) => res.status(201).json({ workLog: await workflow.addWorkLog(req.user!, id(req), workLogSchema.parse(req.body ?? {})) });
export const listWorkLogs = async (req: Request, res: Response) => res.json({ workLogs: await workflow.listWorkLogs(req.user!, id(req)) });
