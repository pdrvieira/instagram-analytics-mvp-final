import { chromium, Browser, BrowserContext, Page, Cookie } from 'playwright';
import { DecryptedSessionPayload, AppError, ErrorCodes, createLogger } from '@ig-analytics/shared';

const logger = createLogger('InstagramClient');

/**
 * Client class to handle all Playwright-based Instagram interactions.
 * This includes login, 2FA, session management, and scraping.
 */
export class InstagramClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly baseUrl = 'https://www.instagram.com';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      /**
   * Initialize Playwright browser with optional session payload.
   * @param sessionPayload Session data (cookies, user agent) to restore a previous session.
   * @param forceHeaded Force browser to run in headed mode (visible window)
   */
  public async initBrowser(sessionPayload?: { cookies: any[], user_agent: string }, forceHeaded: boolean = false): Promise<void> {
    // Only use headed mode if explicitly requested
    const headless = !forceHeaded;
    
    logger.info(`[InstagramClient] Initializing Playwright browser... (${headless ? 'headless' : 'headed'} mode)`);
    
    this.browser = await chromium.launch({ 
      headless,
      args: headless ? [] : ['--start-maximized']
    });
    
    this.context = await this.browser.newContext({
      userAgent: sessionPayload?.user_agent || this.userAgent,
      viewport: headless ? { width: 1280, height: 720 } : null,
    });

    if (sessionPayload?.cookies) {
      await this.context.addCookies(sessionPayload.cookies as any);
    }

    this.page = await this.context.newPage();
    logger.info('[InstagramClient] Browser initialized.');
  }

  /**
   * Closes the browser instance.
   */
  public async close(): Promise<void> {
    if (this.browser) {
      logger.info('Closing Playwright browser...');
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Retrieves the current session payload (cookies and user agent).
   */
  public async getSessionPayload(): Promise<DecryptedSessionPayload> {
    if (!this.context) {
      throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Browser context not initialized.', 500);
    }

    const cookies = await this.context.cookies();
    // Convert Playwright's Cookie type back to the shared DecryptedSessionPayload cookie type
    const sessionCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));

    return {
      cookies: sessionCookies,
      user_agent: this.userAgent,
      timestamp: Date.now(),
    };
  }

  /**
   * Checks if the current session is valid by navigating to the home page.
   * @returns true if logged in, false otherwise.
   */
  public async checkSession(sessionPayload: DecryptedSessionPayload): Promise<boolean> {
    await this.initBrowser(sessionPayload);
    if (!this.page) return false;

    try {
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      // Check for a known element that only appears when logged in (e.g., the "Create" button)
      const isLoggedIn = await this.page.isVisible('text="Create"');
      logger.info(`Session check result: ${isLoggedIn ? 'VALID' : 'EXPIRED'}`);
      return isLoggedIn;
    } catch (error) {
      logger.error('Error during session check', error);
      return false;
    }
  }

  /**
   * Performs the Instagram login process.
   * @param username Instagram username.
   * @param password Instagram password.
   * @param twoFaCode Optional 2FA code.
   * @returns The session payload if successful.
   * @throws AppError if login fails or 2FA is required.
   */
  public async login(username: string, password: string, twoFaCode?: string, showBrowser: boolean = true): Promise<DecryptedSessionPayload> {
    await this.initBrowser(undefined, showBrowser);
    if (!this.page) {
      throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Playwright page not initialized.', 500);
    }

    try {
      logger.info(`[InstagramClient] Navigating to login page...`);
      await this.page.goto(`${this.baseUrl}/accounts/login/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(2000);

      // 1. Enter credentials
      logger.info(`[InstagramClient] Filling in credentials for ${username}...`);
      await this.page.fill('input[name="username"]', username);
      await this.page.fill('input[name="password"]', password);
      await this.page.click('button[type="submit"]');
      
      logger.info(`[InstagramClient] Waiting for navigation after login submit...`);
      await this.page.waitForTimeout(8000); // Wait longer for page to load

      // 2. Check for 2FA prompt - check both input field AND page text
      logger.info('[InstagramClient] Checking for 2FA prompt...');
      const has2FAInput = await this.page.locator('input[name="verificationCode"]').isVisible({ timeout: 5000 }).catch(() => false);
      const pageText = await this.page.textContent('body').catch(() => '') || '';
      logger.info(`[InstagramClient] Page text sample: ${pageText.substring(0, 300).replace(/\s+/g, ' ')}...`);
      
      const has2FAText = pageText.includes('code we sent') || 
                        pageText.includes('Enter the code') ||
                        pageText.includes('security code') ||
                        pageText.includes('verification code') ||
                        pageText.includes('WhatsApp');
      
      const is2faRequired = has2FAInput || has2FAText;
      logger.info(`[InstagramClient] 2FA detection - Input field: ${has2FAInput}, Text: ${has2FAText}`);
      
      if (is2faRequired) {
        logger.info('[InstagramClient] 2FA prompt detected');
        if (!twoFaCode) {
          logger.warn('[InstagramClient] 2FA required but no code provided - browser will stay OPEN');
          logger.info('[InstagramClient] ⚠️  Complete 2FA manually in the browser window that just opened!');
          logger.info('[InstagramClient] ⚠️  Waiting up to 10 MINUTES for manual completion...');
          
          // Poll actively for multiple login success indicators
          const startTime = Date.now();
          const maxWaitMs = 600000; // 10 minutes
          let manualLoginSuccess = false;
          
          while (Date.now() - startTime < maxWaitMs && !manualLoginSuccess) {
            // Check current URL - Instagram redirects to home after successful login
            const currentUrl = this.page.url();
            logger.info(`[InstagramClient] Current URL: ${currentUrl}`);
            
            // Success indicators: redirect away from 2FA page OR presence of home elements
            const isOn2FAPage = currentUrl.includes('/challenge/') || 
                               currentUrl.includes('/accounts/login/two_factor') ||
                               await this.page.locator('input[name="verificationCode"]').isVisible({ timeout: 1000 }).catch(() => false);
            
            if (!isOn2FAPage) {
              // User left 2FA page - check if we're on Instagram home/feed
              const homeIndicators = await Promise.race([
                this.page.locator('svg[aria-label="Home"]').isVisible({ timeout: 3000 }).catch(() => false),
                this.page.locator('a[href="/"][role="link"]').isVisible({ timeout: 3000 }).catch(() => false),
                this.page.locator('svg[aria-label="New post"]').isVisible({ timeout: 3000 }).catch(() => false),
                this.page.locator('[role="main"]').isVisible({ timeout: 3000 }).catch(() => false),
              ]);
              
              if (homeIndicators) {
                manualLoginSuccess = true;
                logger.info('[InstagramClient] ✓ Login success detected! User navigated to Instagram home.');
                break;
              }
            }
            
            // Wait 2 seconds before next check
            await this.page.waitForTimeout(2000);
            logger.info('[InstagramClient] Still waiting for manual 2FA completion...');
          }
          
          if (!manualLoginSuccess) {
            throw new AppError(ErrorCodes.IG_2FA_REQUIRED, '2FA was not completed within 10 minutes.', 401);
          }
          
          logger.info('[InstagramClient] ✓ Manual 2FA completed successfully! Proceeding to save session...');
          // Continue to save session below
        } else {
          logger.info(`[InstagramClient] Entering 2FA code: ${twoFaCode.substring(0, 2)}****`);
          
          // Find the input field - try multiple selectors
          const codeInput = await this.page.locator('input[name="verificationCode"], input[name="security_code"], input[placeholder*="code"], input[type="text"]').first();
          await codeInput.waitFor({ state: 'visible', timeout: 5000 });
          await codeInput.fill(twoFaCode);
          
          logger.info('[InstagramClient] Clicking submit button...');
          // Try to find and click submit button
          const submitButton = await this.page.locator('button[type="submit"], button:has-text("Confirm"), button:has-text("Submit")').first();
          await submitButton.click();
          
          logger.info('[InstagramClient] Waiting for 2FA verification (15s)...');
          await this.page.waitForTimeout(15000); // Wait longer for Instagram to process
        }
      }

      // 3. Check for successful login by looking for authenticated home page elements
      logger.info('[InstagramClient] Checking if login was successful...');
      
      // Try multiple indicators of successful login with longer timeout
      const isLoggedIn = await Promise.race([
        this.page.locator('svg[aria-label="Home"]').isVisible({ timeout: 15000 }).catch(() => false),
        this.page.locator('a[href="/"][role="link"]').first().isVisible({ timeout: 15000 }).catch(() => false),
        this.page.locator('svg[aria-label="New post"]').isVisible({ timeout: 15000 }).catch(() => false),
      ]);

      if (!isLoggedIn) {
        logger.error('[InstagramClient] Login failed - expected elements not found');
        
        // Check for actual error messages
        const errorText = await this.page.locator('#slfErrorAlert').textContent({ timeout: 2000 }).catch(() => null);
        if (errorText) {
          logger.error(`[InstagramClient] Error message found: ${errorText}`);
          throw new AppError(ErrorCodes.IG_LOGIN_FAILED, `Login failed: ${errorText.trim()}`, 401);
        }
        throw new AppError(ErrorCodes.IG_LOGIN_FAILED, 'Login failed for an unknown reason.', 401);
      }

      // 4. Handle "Save Info" prompt (optional)
      const isSaveInfoPrompt = await this.page.locator('button:has-text("Not now"), button:has-text("Not Now")').isVisible({ timeout: 3000 }).catch(() => false);
      if (isSaveInfoPrompt) {
        logger.info('[InstagramClient] Dismissing "Save Info" prompt...');
        await this.page.locator('button:has-text("Not now"), button:has-text("Not Now")').first().click();
        await this.page.waitForTimeout(2000);
      }

      logger.info('Login successful. Retrieving session payload.');
      return this.getSessionPayload();

    } catch (error) {
      // CRITICAL: Do NOT close browser if 2FA is required - user needs to complete it manually
      const is2FAError = error instanceof AppError && error.code === ErrorCodes.IG_2FA_REQUIRED;
      
      if (!is2FAError) {
        logger.info('[InstagramClient] Login error - closing browser');
        await this.close();
      } else {
        logger.info('[InstagramClient] 2FA required - browser will REMAIN OPEN for manual completion');
      }
      
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCodes.IG_LOGIN_FAILED, 'An unexpected error occurred during login.', 500, { originalError: error });
    }
  }

  /**
   * Scrapes complete profile data from Instagram
   * @param igUsername The Instagram username to scrape
   * @returns Profile data including bio, counts, verification status, etc.
   */
  public async scrapeProfile(igUsername: string): Promise<{
    username: string;
    full_name: string | null;
    bio: string | null;
    external_url: string | null;
    profile_pic_url: string | null;
    is_verified: boolean;
    is_business: boolean;
    is_private: boolean;
    category_name: string | null;
    followers_count: number;
    following_count: number;
    media_count: number;
  }> {
    if (!this.page) {
      throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Playwright page not initialized.', 500);
    }

    logger.info(`[InstagramClient] Scraping profile data for ${igUsername}...`);
    
    // First, verify we're logged in by checking Instagram home
    try {
      await this.page.goto(`${this.baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2000);
      
      // Check if we're logged in (look for home elements)
      const isLoggedIn = await this.page.locator('svg[aria-label="Home"]').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!isLoggedIn) {
        logger.error('[InstagramClient] Session expired - not logged in');
        throw new AppError(ErrorCodes.SESSION_EXPIRED, 'Instagram session expired. Please reconnect your account.', 401);
      }
      
      logger.info('[InstagramClient] Session verified - user is logged in');
    } catch (error: any) {
      if (error.code === ErrorCodes.SESSION_EXPIRED) throw error;
      logger.warn('[InstagramClient] Could not verify login status, proceeding anyway');
    }
    
    // Now go to profile page
    await this.page.goto(`${this.baseUrl}/${igUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);

    try {
      // Extract data from page's embedded JSON (most reliable method)
      const profileData = await this.page.evaluate(() => {
        // Instagram embeds user data in <script> tags
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@type'] === 'ProfilePage' || data.mainEntity) {
              return data.mainEntity || data;
            }
          } catch (e) {
            continue;
          }
        }

        // Fallback: extract from React props
        const bodyScripts = Array.from(document.querySelectorAll('script'));
        for (const script of bodyScripts) {
          const text = script.textContent || '';
          if (text.includes('window._sharedData')) {
            const match = text.match(/window\._sharedData\s*=\s*({.+?});/);
            if (match) {
              try {
                const sharedData = JSON.parse(match[1]);
                const userData = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
                if (userData) return userData;
              } catch (e) {
                continue;
              }
            }
          }
        }

        return null;
      });

      if (profileData) {
        logger.info('[InstagramClient] Profile data extracted from embedded JSON');
        logger.info(`[InstagramClient] Followers: ${profileData.edge_followed_by?.count}, Following: ${profileData.edge_follow?.count}, Posts: ${profileData.edge_owner_to_timeline_media?.count}`);
        return {
          username: profileData.username || profileData.alternateName || igUsername,
          full_name: profileData.name || profileData.full_name || null,
          bio: profileData.biography || profileData.bio || null,
          external_url: profileData.external_url || profileData.url || null,
          profile_pic_url: profileData.profile_pic_url || profileData.image || null,
          is_verified: profileData.is_verified || profileData.interactionStatistic?.some((s: any) => s.name === 'verified') || false,
          is_business: profileData.is_business_account || profileData.is_professional_account || false,
          is_private: profileData.is_private || false,
          category_name: profileData.category_name || profileData.category || null,
          followers_count: profileData.edge_followed_by?.count || profileData.followers?.value || 0,
          following_count: profileData.edge_follow?.count || profileData.following?.value || 0,
          media_count: profileData.edge_owner_to_timeline_media?.count || profileData.media_count || 0,
        };
      }

      // Fallback: scrape from visible DOM elements
      logger.info('[InstagramClient] Falling back to DOM scraping...');
      
      const full_name = await this.page.locator('section header h2, section header h1').first().textContent().catch(() => null);
      const bio = await this.page.locator('section header div.-vDIg span, header section div span').first().textContent().catch(() => null);
      const external_url = await this.page.locator('section header a[href^="http"]').first().getAttribute('href').catch(() => null);
      const profile_pic_url = await this.page.locator('header img').first().getAttribute('src').catch(() => null);
      const is_verified = await this.page.locator('svg[aria-label*="Verified"], span[title*="Verified"]').isVisible().catch(() => false);
      
      // Extract counts from meta tags or visible elements
      const counts = await this.page.evaluate(() => {
        const parseNumber = (text: string): number => {
          if (!text) return 0;
          // Remove commas and spaces
          text = text.replace(/[,\s]/g, '');
          // Handle formats like "1.5K", "1.2M", etc.
          const match = text.match(/([\d.]+)([KMB]?)/i);
          if (!match) return 0;
          const num = parseFloat(match[1]);
          const suffix = match[2].toUpperCase();
          if (suffix === 'K') return Math.floor(num * 1000);
          if (suffix === 'M') return Math.floor(num * 1000000);
          if (suffix === 'B') return Math.floor(num * 1000000000);
          return Math.floor(num);
        };

        // Try multiple methods to get the counts
        let followers = 0, following = 0, posts = 0;

        // Method 1: Meta tags (most reliable)
        const metaDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
        if (metaDescription) {
          const followersMatch = metaDescription.match(/([\d,KM.]+)\s+Followers/i);
          const followingMatch = metaDescription.match(/([\d,KM.]+)\s+Following/i);
          const postsMatch = metaDescription.match(/([\d,KM.]+)\s+Posts/i);
          
          if (followersMatch) followers = parseNumber(followersMatch[1]);
          if (followingMatch) following = parseNumber(followingMatch[1]);
          if (postsMatch) posts = parseNumber(postsMatch[1]);
        }

        // Method 2: Links with spans (visible UI)
        if (followers === 0) {
          const followerLink = document.querySelector('a[href*="/followers/"]');
          if (followerLink) {
            const span = followerLink.querySelector('span[title], span > span');
            if (span) {
              const title = span.getAttribute('title') || span.textContent;
              followers = parseNumber(title || '0');
            }
          }
        }

        if (following === 0) {
          const followingLink = document.querySelector('a[href*="/following/"]');
          if (followingLink) {
            const span = followingLink.querySelector('span[title], span > span');
            if (span) {
              const title = span.getAttribute('title') || span.textContent;
              following = parseNumber(title || '0');
            }
          }
        }

        // Method 3: Stats list (fallback)
        if (posts === 0 || followers === 0 || following === 0) {
          const statsList = Array.from(document.querySelectorAll('header section ul li, header ul li'));
          statsList.forEach((li) => {
            const text = li.textContent || '';
            if (text.toLowerCase().includes('post')) {
              posts = parseNumber(text);
            } else if (text.toLowerCase().includes('follower')) {
              followers = parseNumber(text);
            } else if (text.toLowerCase().includes('following')) {
              following = parseNumber(text);
            }
          });
        }

        console.log('[DOM Scrape] Extracted counts:', { followers, following, posts });

        return { followers, following, posts };
      });

      logger.info(`[InstagramClient] DOM scraped counts: ${counts.followers} followers, ${counts.following} following, ${counts.posts} posts`);

      return {
        username: igUsername,
        full_name: full_name?.trim() || null,
        bio: bio?.trim() || null,
        external_url,
        profile_pic_url,
        is_verified,
        is_business: false, // Can't reliably detect from DOM
        is_private: await this.page.locator('h2:has-text("This Account is Private")').isVisible().catch(() => false),
        category_name: null,
        followers_count: counts.followers,
        following_count: counts.following,
        media_count: counts.posts,
      };
    } catch (error) {
      logger.error('[InstagramClient] Profile scraping failed', error);
      throw new AppError(ErrorCodes.IG_SCRAPE_FAILED, 'Failed to scrape profile data', 500, { originalError: error });
    }
  }

  /**
   * Scrapes the list of followers and following.
   * @param igUsername The Instagram username to scrape.
   * @param maxCount Maximum users to scrape per list (default: 1000, set to -1 for all)
   * @returns An object containing follower and following lists.
   */
  public async scrapeFollowers(igUsername: string, maxCount: number = -1): Promise<{ 
    followers: Array<{
      ig_id: string;
      username: string;
      full_name: string | null;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string | null;
    }>, 
    following: Array<{
      ig_id: string;
      username: string;
      full_name: string | null;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string | null;
    }>
  }> {
    if (!this.page) {
      throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Playwright page not initialized.', 500);
    }

    logger.info(`[InstagramClient] Scraping followers and following for ${igUsername} using GraphQL API...`);
    
    // Navigate to profile to get user ID
    await this.page.goto(`${this.baseUrl}/${igUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    // Extract user ID from page source
    const userId = await this.page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('profilePage_')) {
          const match = text.match(/"profilePage_(\d+)"/);
          if (match) return match[1];
        }
        if (text.includes('"id":"')) {
          const match = text.match(/"id":"(\d+)"/);
          if (match) return match[1];
        }
      }
      return null;
    });

    if (!userId) {
      logger.error('[InstagramClient] Could not extract user ID from profile page');
      throw new AppError(ErrorCodes.IG_SCRAPE_FAILED, 'Failed to get user ID', 500);
    }

    logger.info(`[InstagramClient] User ID: ${userId}`);

    // Use GraphQL API to fetch all followers and following
    const followers = await this.fetchUserListViaGraphQL(userId, 'followers', maxCount);
    await this.page.waitForTimeout(3000); // Rate limiting
    const following = await this.fetchUserListViaGraphQL(userId, 'following', maxCount);

    logger.info(`[InstagramClient] ✅ Scraped ${followers.length} followers and ${following.length} following via GraphQL`);
    return { followers, following };
  }

  /**
   * Fetch complete user list using Instagram's internal GraphQL API
   */
  private async fetchUserListViaGraphQL(userId: string, type: 'followers' | 'following', maxCount: number = -1): Promise<Array<{
    ig_id: string;
    username: string;
    full_name: string | null;
    is_private: boolean;
    is_verified: boolean;
    profile_pic_url: string | null;
  }>> {
    if (!this.page) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Page not initialized', 500);

    logger.info(`[InstagramClient] Fetching ${type} via GraphQL API...`);

    const users: Array<{
      ig_id: string;
      username: string;
      full_name: string | null;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string | null;
    }> = [];

    // GraphQL query hashes (these may change - Instagram updates them periodically)
    const queryHash = type === 'followers' ? 'c76146de99bb02f6415203be841dd25a' : 'd04b0a864b4b54837c0d870b0e77e076';
    
    let hasNextPage = true;
    let afterCursor = null;

    while (hasNextPage && (maxCount === -1 || users.length < maxCount)) {
      try {
        // Build GraphQL query
        const variables: any = {
          id: userId,
          include_reel: true,
          fetch_mutual: true,
          first: 50, // Fetch 50 at a time
          after: afterCursor,
        };

        const url: string = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;

        // Make request using page context (preserves cookies)
        const response: any = await this.page.evaluate(async (fetchUrl) => {
          const res = await fetch(fetchUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'x-requested-with': 'XMLHttpRequest',
            },
          });
          return await res.json();
        }, url);

        // Parse response
        const edgeKey = type === 'followers' ? 'edge_followed_by' : 'edge_follow';
        const edges = response?.data?.user?.[edgeKey]?.edges || [];
        const pageInfo: any = response?.data?.user?.[edgeKey]?.page_info || {};

        if (edges.length === 0) {
          logger.warn(`[InstagramClient] No more ${type} found in response`);
          break;
        }

        // Extract users from edges
        for (const edge of edges) {
          const node = edge.node;
          users.push({
            ig_id: node.id || node.username,
            username: node.username,
            full_name: node.full_name || null,
            is_private: node.is_private || false,
            is_verified: node.is_verified || false,
            profile_pic_url: node.profile_pic_url || null,
          });

          if (maxCount !== -1 && users.length >= maxCount) {
            hasNextPage = false;
            break;
          }
        }

        logger.info(`[InstagramClient] Fetched ${users.length} ${type} so far...`);

        // Check if there's more data
        hasNextPage = pageInfo.has_next_page || false;
        afterCursor = pageInfo.end_cursor || null;

        if (!hasNextPage || !afterCursor) {
          logger.info(`[InstagramClient] Reached end of ${type} list`);
          break;
        }

        // Rate limiting - wait between requests
        await this.page.waitForTimeout(1500);

      } catch (error) {
        logger.error(`[InstagramClient] GraphQL request failed for ${type}:`, error);
        // If GraphQL fails, break instead of crashing
        break;
      }
    }

    return users;
  }

  /**
   * Scrapes all media posts for a given user
   */
  public async scrapeMedia(igUsername: string, maxPosts: number = 50): Promise<Array<{
    media_id: string;
    shortcode: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
    caption_text: string | null;
    hashtags: string[];
    mentions: string[];
    timestamp: string;
    media_url: string | null;
    likes_count: number;
    comments_count: number;
    video_views: number | null;
  }>> {
    if (!this.page) {
      throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Playwright page not initialized.', 500);
    }

    logger.info(`[InstagramClient] Scraping media for ${igUsername} using GraphQL API...`);
    
    // Navigate to profile to get user ID
    await this.page.goto(`${this.baseUrl}/${igUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    // Extract user ID from page source
    const userId = await this.page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('profilePage_')) {
          const match = text.match(/"profilePage_(\d+)"/);
          if (match) return match[1];
        }
        if (text.includes('"id":"')) {
          const match = text.match(/"id":"(\d+)"/);
          if (match) return match[1];
        }
      }
      return null;
    });

    if (!userId) {
      logger.error('[InstagramClient] Could not extract user ID from profile page');
      throw new AppError(ErrorCodes.IG_SCRAPE_FAILED, 'Failed to get user ID', 500);
    }

    // Use GraphQL API to fetch all media
    const media = await this.fetchMediaViaGraphQL(userId, maxPosts);

    logger.info(`[InstagramClient] ✅ Scraped ${media.length} posts via GraphQL`);
    return media;
  }

  /**
   * Fetch media using Instagram's internal GraphQL API
   * Falls back to embedded page data if GraphQL fails
   */
  private async fetchMediaViaGraphQL(userId: string, maxPosts: number = 50): Promise<Array<{
    media_id: string;
    shortcode: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
    caption_text: string | null;
    hashtags: string[];
    mentions: string[];
    timestamp: string;
    media_url: string | null;
    likes_count: number;
    comments_count: number;
    video_views: number | null;
  }>> {
    if (!this.page) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Page not initialized', 500);

    logger.info(`[InstagramClient] Fetching media via embedded page data...`);

    // Extract media from page's embedded JSON (more reliable than GraphQL)
    const media = await this.page.evaluate((maxCount) => {
      const result: Array<{
        media_id: string;
        shortcode: string;
        media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
        caption_text: string | null;
        hashtags: string[];
        mentions: string[];
        timestamp: string;
        media_url: string | null;
        likes_count: number;
        comments_count: number;
        video_views: number | null;
      }> = [];

      // Try to find embedded data in page scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        
        // Look for window._sharedData or embedded JSON
        if (text.includes('window._sharedData')) {
          const match = text.match(/window\._sharedData\s*=\s*({.+?});/);
          if (match) {
            try {
              const sharedData = JSON.parse(match[1]);
              const userData = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
              if (userData?.edge_owner_to_timeline_media?.edges) {
                const edges = userData.edge_owner_to_timeline_media.edges.slice(0, maxCount);
                
                for (const edge of edges) {
                  const node = edge.node;
                  
                  // Extract caption
                  const captionEdges = node.edge_media_to_caption?.edges || [];
                  const caption = captionEdges.length > 0 ? captionEdges[0].node.text : '';
                  
                  // Extract hashtags and mentions
                  const hashtagMatches = caption.match(/#\w+/g) || [];
                  const mentionMatches = caption.match(/@\w+/g) || [];

                  // Determine media type
                  let mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' = 'IMAGE';
                  if (node.__typename === 'GraphVideo') {
                    mediaType = 'VIDEO';
                  } else if (node.__typename === 'GraphSidecar') {
                    mediaType = 'CAROUSEL';
                  }

                  result.push({
                    media_id: node.id,
                    shortcode: node.shortcode,
                    media_type: mediaType,
                    caption_text: caption || null,
                    hashtags: hashtagMatches.map((h: string) => h.substring(1)),
                    mentions: mentionMatches.map((m: string) => m.substring(1)),
                    timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
                    media_url: node.display_url || node.thumbnail_src || null,
                    likes_count: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
                    comments_count: node.edge_media_to_comment?.count || node.edge_media_preview_comment?.count || 0,
                    video_views: node.video_view_count || null,
                  });
                }
                
                return result;
              }
            } catch (e) {
              console.error('Failed to parse _sharedData:', e);
            }
          }
        }
        
        // Try alternative: embedded application/json scripts
        if (text.includes('"edge_owner_to_timeline_media"')) {
          try {
            const jsonMatch = text.match(/({[\s\S]*})/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[1]);
              if (data.graphql?.user?.edge_owner_to_timeline_media?.edges) {
                const edges = data.graphql.user.edge_owner_to_timeline_media.edges.slice(0, maxCount);
                
                for (const edge of edges) {
                  const node = edge.node;
                  const captionEdges = node.edge_media_to_caption?.edges || [];
                  const caption = captionEdges.length > 0 ? captionEdges[0].node.text : '';
                  const hashtagMatches = caption.match(/#\w+/g) || [];
                  const mentionMatches = caption.match(/@\w+/g) || [];

                  let mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' = 'IMAGE';
                  if (node.__typename === 'GraphVideo') mediaType = 'VIDEO';
                  else if (node.__typename === 'GraphSidecar') mediaType = 'CAROUSEL';

                  result.push({
                    media_id: node.id,
                    shortcode: node.shortcode,
                    media_type: mediaType,
                    caption_text: caption || null,
                    hashtags: hashtagMatches.map((h: string) => h.substring(1)),
                    mentions: mentionMatches.map((m: string) => m.substring(1)),
                    timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
                    media_url: node.display_url || node.thumbnail_src || null,
                    likes_count: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
                    comments_count: node.edge_media_to_comment?.count || node.edge_media_preview_comment?.count || 0,
                    video_views: node.video_view_count || null,
                  });
                }
                
                return result;
              }
            }
          } catch (e) {
            console.error('Failed to parse embedded JSON:', e);
          }
        }
      }

      return result;
    }, maxPosts);

    if (media.length > 0) {
      logger.info(`[InstagramClient] Extracted ${media.length} posts from embedded page data`);
      return media;
    }

    // If embedded data extraction failed, try to visit each post individually
    logger.info(`[InstagramClient] Embedded data not found, scraping from profile grid...`);
    
    const postLinks = await this.page.evaluate(() => {
      const links: string[] = [];
      const anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.includes('/liked_by/') && !href.includes('/embed/')) {
          links.push(href);
        }
      });
      return [...new Set(links)]; // Remove duplicates
    });

    logger.info(`[InstagramClient] Found ${postLinks.length} post links on profile page`);

    const scrapedMedia: typeof media = [];
    const limit = Math.min(postLinks.length, maxPosts);

    for (let i = 0; i < limit; i++) {
      try {
        const postUrl = `${this.baseUrl}${postLinks[i]}`;
        logger.info(`[InstagramClient] Scraping post ${i + 1}/${limit}: ${postLinks[i]}`);
        
        await this.page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(2000);

        const postData = await this.page.evaluate((shortcode) => {
          // Extract from embedded JSON in post page
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const text = script.textContent || '';
            if (text.includes('"shortcode_media"') || text.includes(shortcode)) {
              try {
                const match = text.match(/window\.__additionalDataLoaded\([^,]+,({.+})\)/);
                if (match) {
                  const data = JSON.parse(match[1]);
                  const media = data.graphql?.shortcode_media || data.items?.[0];
                  if (media) return media;
                }
              } catch (e) {
                continue;
              }
            }
          }
          return null;
        }, postLinks[i].match(/\/(p|reel)\/([^\/]+)/)?.[2] || '');

        if (postData) {
          const captionEdges = postData.edge_media_to_caption?.edges || [];
          const caption = captionEdges.length > 0 ? captionEdges[0].node.text : '';
          const hashtags = caption.match(/#\w+/g) || [];
          const mentions = caption.match(/@\w+/g) || [];

          let mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' = 'IMAGE';
          if (postData.__typename === 'GraphVideo') mediaType = 'VIDEO';
          else if (postData.__typename === 'GraphSidecar') mediaType = 'CAROUSEL';

          scrapedMedia.push({
            media_id: postData.id,
            shortcode: postData.shortcode,
            media_type: mediaType,
            caption_text: caption || null,
            hashtags: hashtags.map((h: string) => h.substring(1)),
            mentions: mentions.map((m: string) => m.substring(1)),
            timestamp: new Date(postData.taken_at_timestamp * 1000).toISOString(),
            media_url: postData.display_url || postData.thumbnail_src || null,
            likes_count: postData.edge_liked_by?.count || postData.edge_media_preview_like?.count || 0,
            comments_count: postData.edge_media_to_comment?.count || postData.edge_media_preview_comment?.count || 0,
            video_views: postData.video_view_count || null,
          });
        }

        await this.page.waitForTimeout(1000); // Rate limiting
      } catch (error) {
        logger.warn(`[InstagramClient] Failed to scrape post ${postLinks[i]}:`, error);
        continue;
      }
    }

    logger.info(`[InstagramClient] Scraped ${scrapedMedia.length} posts from individual pages`);
    return scrapedMedia;
  }

  /**
   * DEPRECATED: Old modal-based scraper for followers/following
   * Now using GraphQL API instead (much faster and more reliable)
   */
  private async scrapeUserList(username: string, type: 'followers' | 'following', maxCount: number): Promise<Array<{
    ig_id: string;
    username: string;
    full_name: string | null;
    is_private: boolean;
    is_verified: boolean;
    profile_pic_url: string | null;
  }>> {
    // This method is kept for potential fallback but not used anymore
    logger.warn(`[InstagramClient] scrapeUserList called - this is deprecated, using GraphQL instead`);
    return [];
  }
}
