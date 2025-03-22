export const paginateResults = <T>(data: T[], page?: number, limit?: number) => {
    const pageSize = limit && !isNaN(limit) ? limit : 10;
    const currentPage = page && !isNaN(page) && page > 0 ? page : 1;
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
  
    return {
      totalItems,
      totalPages,
      currentPage,
      prevPage: currentPage > 1 ? currentPage - 1 : 0,
      nextPage: currentPage < totalPages ? currentPage + 1 : 0,
      itemPerPage: limit ? limit : 10,
      data: data.slice(startIndex, endIndex),
    };
  };
  