import { Repository, FindManyOptions, ObjectLiteral } from 'typeorm';
import { PaginationDto } from './pagination.dto';
import { PaginatedResponse } from './paginated.response';

export async function paginate<T extends ObjectLiteral>(
  repo: Repository<T>,
  pagination: PaginationDto,
  options: FindManyOptions<T> = {},
): Promise<PaginatedResponse<T>> {
  const { page = 1, limit = 20 } = pagination;

  const [data, total] = await repo.findAndCount({
    ...options,
    skip: pagination.skip,
    take: limit,
  });

  return new PaginatedResponse(data, total, page, limit);
}
