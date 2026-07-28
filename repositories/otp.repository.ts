import { prisma } from '@/lib/prisma';
import { Prisma, type Otp } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

// Standard interface per docs/repository-contract.md. No business logic here —
// the service owns the 60s send cooldown and expiry rules.
export const otpRepository = {
  async findLatestByPhone(phone: string, tx: Tx | typeof prisma = prisma): Promise<Otp | null> {
    return tx.otp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
  },

  async findValid(phone: string, code: string, tx: Tx | typeof prisma = prisma): Promise<Otp | null> {
    return tx.otp.findFirst({ where: { phone, code, expiresAt: { gt: new Date() } } });
  },

  async create(data: { phone: string; code: string; expiresAt: Date }, tx: Tx | typeof prisma = prisma): Promise<Otp> {
    return tx.otp.create({ data });
  },

  async deleteByPhone(phone: string, tx: Tx | typeof prisma = prisma): Promise<void> {
    await tx.otp.deleteMany({ where: { phone } });
  },

  async deleteById(id: string, tx: Tx | typeof prisma = prisma): Promise<void> {
    await tx.otp.delete({ where: { id } });
  },
};
