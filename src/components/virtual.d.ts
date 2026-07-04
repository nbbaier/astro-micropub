declare module "virtual:astro-micropub/config" {
  /**
   * Absolute discovery links injected by the astro-micropub integration.
   */
  export const discovery: {
    enabled: boolean;
    micropub: string;
    micropubMedia: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
  };
}
