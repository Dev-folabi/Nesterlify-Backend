export const paginateResults = <T>(
    data: T[],
    page: number = 1,
    limit: number = 10
  ) => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
  
    return {
      totalItems,
      totalPages,
      currentPage,
      pageSize: limit,
      data: data.slice(startIndex, endIndex),
    };
  };
  