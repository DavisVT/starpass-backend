import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';

describe('CreatorsService – co-ownership', () => {
  let service: CreatorsService;

  const CREATOR_ID = 'creator-uuid';
  const OWNER_ADDRESS = 'GB_OWNER';
  const EDITOR_ADDRESS = 'GB_EDITOR';
  const STRANGER_ADDRESS = 'GB_STRANGER';

  const mockCreator = { id: CREATOR_ID, stellarAddress: OWNER_ADDRESS };

  const mockPrisma = {
    creator: { findUnique: jest.fn() },
    creatorMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    pass: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
    jest.clearAllMocks();
  });

  describe('addMember', () => {
    it('allows creator owner to add an editor', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null); // not an OWNER member, but stellarAddress matches
      mockPrisma.creatorMember.findUnique.mockResolvedValue(null); // not already a member
      const newMember = { id: 'mem-1', creatorId: CREATOR_ID, address: EDITOR_ADDRESS, role: 'EDITOR' };
      mockPrisma.creatorMember.create.mockResolvedValue(newMember);

      const result = await service.addMember(CREATOR_ID, OWNER_ADDRESS, EDITOR_ADDRESS, 'EDITOR');

      expect(mockPrisma.creatorMember.create).toHaveBeenCalledWith({
        data: { creatorId: CREATOR_ID, address: EDITOR_ADDRESS, role: 'EDITOR' },
      });
      expect(result).toEqual(newMember);
    });

    it('allows a member OWNER to add another editor', async () => {
      const coOwnerAddress = 'GB_CO_OWNER';
      mockPrisma.creator.findUnique.mockResolvedValue({ id: CREATOR_ID, stellarAddress: OWNER_ADDRESS });
      // callerAddress !== stellarAddress, so check members
      mockPrisma.creatorMember.findFirst.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.creatorMember.findUnique.mockResolvedValue(null);
      mockPrisma.creatorMember.create.mockResolvedValue({ id: 'mem-2', address: EDITOR_ADDRESS, role: 'EDITOR' });

      await expect(
        service.addMember(CREATOR_ID, coOwnerAddress, EDITOR_ADDRESS, 'EDITOR'),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when caller is only an EDITOR', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: CREATOR_ID, stellarAddress: OWNER_ADDRESS });
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null); // not an OWNER member
      // caller is not stellarAddress owner either
      await expect(
        service.addMember(CREATOR_ID, EDITOR_ADDRESS, STRANGER_ADDRESS, 'EDITOR'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when caller is a stranger', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember(CREATOR_ID, STRANGER_ADDRESS, EDITOR_ADDRESS, 'EDITOR'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when member already exists', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);
      mockPrisma.creatorMember.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addMember(CREATOR_ID, OWNER_ADDRESS, EDITOR_ADDRESS, 'EDITOR'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when creator does not exist', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('unknown-id', OWNER_ADDRESS, EDITOR_ADDRESS, 'EDITOR'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('allows owner to remove an editor', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);
      mockPrisma.creatorMember.findUnique.mockResolvedValue({ id: 'mem-1', address: EDITOR_ADDRESS });
      mockPrisma.creatorMember.delete.mockResolvedValue({});

      const result = await service.removeMember(CREATOR_ID, OWNER_ADDRESS, EDITOR_ADDRESS);

      expect(mockPrisma.creatorMember.delete).toHaveBeenCalledWith({
        where: { creatorId_address: { creatorId: CREATOR_ID, address: EDITOR_ADDRESS } },
      });
      expect(result).toEqual({ message: 'Member removed' });
    });

    it('throws ForbiddenException when caller is not an owner', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember(CREATOR_ID, STRANGER_ADDRESS, EDITOR_ADDRESS),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when member does not exist', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);
      mockPrisma.creatorMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember(CREATOR_ID, OWNER_ADDRESS, STRANGER_ADDRESS),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('isMemberOrOwner', () => {
    it('returns true for the creator owner', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      expect(await service.isMemberOrOwner(CREATOR_ID, OWNER_ADDRESS)).toBe(true);
    });

    it('returns true for a member', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue({ role: 'EDITOR' });
      expect(await service.isMemberOrOwner(CREATOR_ID, EDITOR_ADDRESS)).toBe(true);
    });

    it('returns false for a stranger', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrisma.creatorMember.findFirst.mockResolvedValue(null);
      expect(await service.isMemberOrOwner(CREATOR_ID, STRANGER_ADDRESS)).toBe(false);
    });

    it('returns false when creator does not exist', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);
      expect(await service.isMemberOrOwner('unknown', OWNER_ADDRESS)).toBe(false);
    });
  });
});
