import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "video.movie";
  structuredData?: Record<string, unknown>;
}

const SITE_NAME = "StreamFlow";
const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");

const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
};

const setLink = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
};

const SEO = ({ title, description, path = "/", image = "/logo.png", type = "website", structuredData }: SEOProps) => {
  useEffect(() => {
    const pageTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalPath = path.startsWith("/") ? path : `/${path}`;
    const canonicalUrl = SITE_URL
      ? `${SITE_URL}${canonicalPath}`
      : `${window.location.origin}${canonicalPath}`;
    const imageUrl = image.startsWith("http")
      ? image
      : `${SITE_URL || window.location.origin}${image.startsWith("/") ? image : `/${image}`}`;

    document.title = pageTitle;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="author"]', "name", "author", SITE_NAME);
    setMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME);
    setMeta('meta[property="og:title"]', "property", "og:title", pageTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:type"]', "property", "og:type", type);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[property="og:image"]', "property", "og:image", imageUrl);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", pageTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", imageUrl);
    setLink("canonical", canonicalUrl);

    const scriptId = "page-structured-data";
    document.getElementById(scriptId)?.remove();

    if (structuredData) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...structuredData,
      });
      document.head.appendChild(script);
    }
  }, [description, image, path, structuredData, title, type]);

  return null;
};

export default SEO;
