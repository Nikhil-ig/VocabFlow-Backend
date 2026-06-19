import { Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';

const orgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().optional().or(z.literal('')),
  customDomain: z.string().optional().or(z.literal('')),
  subscriptionTier: z.string().optional(),
});

const orgUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().optional().or(z.literal('')),
  customDomain: z.string().optional().or(z.literal('')),
  subscriptionTier: z.string().optional(),
});

export const getOrganizations = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (user.role === 'SUPERADMIN') {
      const orgs = await prisma.organization.findMany();
      res.json({ success: true, data: orgs });
    } else if (user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.organizationId }
      });
      res.json({ success: true, data: org ? [org] : [] });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createOrganization = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const parsed = orgSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const org = await prisma.organization.create({
      data: parsed.data
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id }
    });

    res.status(201).json({ success: true, data: org });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to create organization' });
  }
};

export const updateOrganization = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || (user.role !== 'SUPERADMIN' && (user.role !== 'ADMIN' || user.organizationId !== id))) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const parsed = orgUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const org = await prisma.organization.update({
      where: { id },
      data: parsed.data
    });

    res.json({ success: true, data: org });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to update organization' });
  }
};
