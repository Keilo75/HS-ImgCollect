export interface Image {
  url: string;
  img: string;
}

export interface CrawlOptions {
  searchTerm: string;
  limit?: number;
  offset?: number;
  engine: 'bing' | 'google';
}
