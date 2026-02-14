import { getAppUrl } from './appConfig';

export interface MetaTagsConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

export function updateMetaTags(config: MetaTagsConfig) {
  const { title, description, image, url, type = 'profile' } = config;

  document.title = title;

  const metaTags = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: 'RatingSkill' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:site', content: '@RatingSkill' },
    { name: 'description', content: description },
  ];

  if (image) {
    metaTags.push(
      { property: 'og:image', content: image },
      { property: 'og:image:alt', content: title },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: title }
    );
  }

  if (url) {
    metaTags.push({ property: 'og:url', content: url });
  }

  metaTags.forEach(({ property, name, content }) => {
    const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
    let element = document.querySelector(selector);

    if (!element) {
      element = document.createElement('meta');
      if (property) {
        element.setAttribute('property', property);
      } else if (name) {
        element.setAttribute('name', name);
      }
      document.head.appendChild(element);
    }

    element.setAttribute('content', content);
  });
}

export function getAbsoluteImageUrl(imageUrl: string | null | undefined): string {
  const baseUrl = getAppUrl();

  if (!imageUrl) {
    return `${baseUrl}/og-image.png`;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/')) {
    return `${baseUrl}${imageUrl}`;
  }

  return `${baseUrl}/${imageUrl}`;
}

export function getProfileCardUrl(username: string): string {
  return `${getAppUrl()}/card/${username}`;
}
