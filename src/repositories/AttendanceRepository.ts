import { Repository, FindOptionsWhere, FindManyOptions } from "typeorm";
import { Attendance, AttendanceStatus, AttendanceType } from "@/entities";

/**
 * Tipos específicos do repository
 */
export interface MissingAttendance {
  date: string;
  shiftId: string;
  doctorId: string;
  doctorName?: string;
  specialty?: string;
  hasInPunch: boolean;
  hasOutPunch: boolean;
  status: string;
}

export interface AttendanceStatistics {
  total: number;
  byStatus: Record<AttendanceStatus, number>;
  byType: Record<AttendanceType, number>;
  averageLateMinutes: number;
  totalDiscounts: number;
  lateCount: number;
  onTimeCount: number;
}

/**
 * Interface para o repository de Attendance
 * Abstração para acesso a dados
 */
export interface IAttendanceRepository {
  findById(id: string): Promise<Attendance | null>;
  findOne(where: FindOptionsWhere<Attendance>): Promise<Attendance | null>;
  find(where: FindOptionsWhere<Attendance>): Promise<Attendance[]>;
  findAndCount(options: FindManyOptions<Attendance>): Promise<[Attendance[], number]>;
  create(data: Partial<Attendance>): Attendance;
  save(attendance: Attendance): Promise<Attendance>;
  update(id: string, data: Partial<Attendance>): Promise<void>;
  
  // Queries específicas
  findByShiftAndDoctor(shiftId: string, doctorId: string, type?: AttendanceType): Promise<Attendance | null>;
  findPendingByShift(shiftId: string): Promise<Attendance[]>;
  findPendingWithLateInfo(shiftId: string): Promise<Attendance[]>;
  findByShiftAndStatus(shiftId: string, status: AttendanceStatus): Promise<Attendance[]>;
  findOpenPunchesForDay(doctorId: string, date: Date): Promise<Attendance[]>;
  findOpenPunchesLate(hospitalId: string, startDate: Date, endDate: Date): Promise<Attendance[]>;
  findApprovedForDiscountControl(shiftId: string): Promise<Attendance[]>;
  findMissingAttendances(filters: {
    hospitalId?: string;
    doctorId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<MissingAttendance[]>;
  countByStatusForDay(hospitalId: string, startDate: Date, endDate: Date): Promise<Record<AttendanceStatus, number>>;
  getStatistics(hospitalId: string, startDate: Date, endDate: Date): Promise<AttendanceStatistics>;
}

/**
 * Implementação concreta do repository usando TypeORM
 */
export class AttendanceRepository implements IAttendanceRepository {
  constructor(private repository: Repository<Attendance>) {}

  async findById(id: string): Promise<Attendance | null> {
    return this.repository.findOne({
      where: { id },
      relations: ["doctor", "shift", "shift.hospital", "shift.doctor"],
    });
  }

  async findOne(where: FindOptionsWhere<Attendance>): Promise<Attendance | null> {
    return this.repository.findOne({ where });
  }

  async find(where: FindOptionsWhere<Attendance>): Promise<Attendance[]> {
    return this.repository.find({ where });
  }

  async findAndCount(options: FindManyOptions<Attendance>): Promise<[Attendance[], number]> {
    return this.repository.findAndCount(options);
  }

  create(data: Partial<Attendance>): Attendance {
    return this.repository.create(data);
  }

  async save(attendance: Attendance): Promise<Attendance> {
    return this.repository.save(attendance);
  }

  async update(id: string, data: Partial<Attendance>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async findByShiftAndDoctor(
    shiftId: string,
    doctorId: string,
    type?: AttendanceType
  ): Promise<Attendance | null> {
    const where: FindOptionsWhere<Attendance> = {
      doctorId,
      shiftId,
      ...(type && { type }),
    };

    return this.repository.findOne({
      where,
      relations: ["doctor", "shift"],
      order: { timestamp: "ASC" },
    });
  }

  async findPendingByShift(shiftId: string): Promise<Attendance[]> {
    return this.repository.find({
      where: { shiftId, status: "PENDING" },
      order: { timestamp: "ASC" },
    });
  }

  async findByShiftAndStatus(
    shiftId: string,
    status: AttendanceStatus
  ): Promise<Attendance[]> {
    return this.repository.find({
      where: { shiftId, status },
      order: { timestamp: "ASC" },
    });
  }

  async findOpenPunchesForDay(doctorId: string, date: Date): Promise<Attendance[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Busca INs sem OUTs correspondentes
    const qb = this.repository
      .createQueryBuilder("att")
      .leftJoinAndSelect("att.shift", "shift")
      .leftJoinAndSelect("att.doctor", "doctor")
      .where("att.doctorId = :doctorId", { doctorId })
      .andWhere("att.type = :inType", { inType: "IN" })
      .andWhere("att.timestamp BETWEEN :start AND :end", {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select("1")
          .from(Attendance, "a2")
          .where('a2."shiftId" = att."shiftId"')
          .andWhere('a2."doctorId" = att."doctorId"')
          .andWhere("a2.type = 'OUT'")
          .andWhere("a2.timestamp BETWEEN :start AND :end")
          .getQuery();
        return `NOT EXISTS (${sub})`;
      });

    return qb.orderBy("att.timestamp", "ASC").getMany();
  }

  async countByStatusForDay(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<AttendanceStatus, number>> {
    const rows = await this.repository
      .createQueryBuilder("att")
      .innerJoin("att.shift", "s")
      .select("att.status", "status")
      .addSelect("COUNT(att.id)", "count")
      .where('s."hospitalId" = :hospitalId', { hospitalId })
      .andWhere("att.timestamp BETWEEN :start AND :end", {
        start: startDate,
        end: endDate,
      })
      .groupBy("att.status")
      .getRawMany<{ status: AttendanceStatus; count: string }>();

    const counts: Record<AttendanceStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };

    rows.forEach((r) => (counts[r.status] = parseInt(r.count, 10)));
    return counts;
  }

  /**
   * Lista pontos pendentes com informações de atraso
   */
  async findPendingWithLateInfo(shiftId: string): Promise<Attendance[]> {
    return this.repository.find({
      where: { shiftId, status: 'PENDING' },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * Lista INs abertos (sem OUT correspondente) que estão atrasados
   */
  async findOpenPunchesLate(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Attendance[]> {
    const qb = this.repository
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.shift', 'shift')
      .where('att.type = :inType', { inType: 'IN' })
      .andWhere('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere('att.isLate = :isLate', { isLate: true })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(Attendance, 'a2')
          .where('a2.shiftId = att.shiftId')
          .andWhere('a2.doctorId = att.doctorId')
          .andWhere('a2.type = :outType', { outType: 'OUT' })
          .andWhere('a2.timestamp BETWEEN :start AND :end')
          .getQuery();
        return `NOT EXISTS (${sub})`;
      });

    if (hospitalId) {
      qb.andWhere('shift.hospitalId = :hospitalId', { hospitalId });
    }

    return qb.orderBy('att.timestamp', 'ASC').getMany();
  }

  /**
   * Lista pontos aprovados para controle de desconto
   */
  async findApprovedForDiscountControl(shiftId: string): Promise<Attendance[]> {
    return this.repository.find({
      where: { shiftId, status: 'APPROVED' },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * Busca pontos faltantes (shifts sem attendance)
   * Nota: Esta query precisa ser feita com cache de shifts
   */
  async findMissingAttendances(filters: {
    hospitalId?: string;
    doctorId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<MissingAttendance[]> {
    // Esta query será implementada no service que tem acesso ao cache de shifts
    // Por enquanto, retornamos array vazio
    return [];
  }

  /**
   * Retorna estatísticas agregadas de attendance
   */
  async getStatistics(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceStatistics> {
    const qb = this.repository
      .createQueryBuilder('att')
      .leftJoin('att.shift', 's')
      .where('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });

    if (hospitalId) {
      qb.andWhere('s.hospitalId = :hospitalId', { hospitalId });
    }

    const totalAttendances = await qb.getCount();

    const byStatus = await this.repository
      .createQueryBuilder('att')
      .leftJoin('att.shift', 's')
      .select('att.status', 'status')
      .addSelect('COUNT(att.id)', 'count')
      .where('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere(hospitalId ? 's.hospitalId = :hospitalId' : '1=1', { hospitalId })
      .groupBy('att.status')
      .getRawMany();

    const byType = await this.repository
      .createQueryBuilder('att')
      .leftJoin('att.shift', 's')
      .select('att.type', 'type')
      .addSelect('COUNT(att.id)', 'count')
      .where('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere(hospitalId ? 's.hospitalId = :hospitalId' : '1=1', { hospitalId })
      .groupBy('att.type')
      .getRawMany();

    const lateStats = await this.repository
      .createQueryBuilder('att')
      .leftJoin('att.shift', 's')
      .select('COUNT(att.id)', 'totalLate')
      .addSelect('AVG(att.lateMinutes)', 'avgLateMinutes')
      .where('att.isLate = :isLate', { isLate: true })
      .andWhere('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere(hospitalId ? 's.hospitalId = :hospitalId' : '1=1', { hospitalId })
      .getRawOne();

    const discountStats = await this.repository
      .createQueryBuilder('att')
      .leftJoin('att.shift', 's')
      .select('COUNT(att.id)', 'totalWithDiscount')
      .addSelect('AVG(att.discountPercentage)', 'avgDiscountPercentage')
      .where('att.approvedWithDiscount = :approved', { approved: true })
      .andWhere('att.timestamp BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere(hospitalId ? 's.hospitalId = :hospitalId' : '1=1', { hospitalId })
      .getRawOne();

    interface StatusCount {
      status: AttendanceStatus;
      count: string;
    }

    interface TypeCount {
      type: AttendanceType;
      count: string;
    }

    return {
      total: totalAttendances,
      byStatus: byStatus.reduce((acc: Record<AttendanceStatus, number>, item: StatusCount) => {
        acc[item.status] = parseInt(item.count, 10);
        return acc;
      }, {} as Record<AttendanceStatus, number>),
      byType: byType.reduce((acc: Record<AttendanceType, number>, item: TypeCount) => {
        acc[item.type] = parseInt(item.count, 10);
        return acc;
      }, {} as Record<AttendanceType, number>),
      averageLateMinutes: parseFloat(lateStats?.avgLateMinutes || '0'),
      totalDiscounts: parseInt(discountStats?.totalWithDiscount || '0', 10),
      lateCount: parseInt(lateStats?.totalLate || '0', 10),
      onTimeCount: totalAttendances - parseInt(lateStats?.totalLate || '0', 10),
    };
  }
}