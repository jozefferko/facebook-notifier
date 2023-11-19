
import { PlaywrightCrawler } from 'crawlee';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const FACEBOOK_USERNAME = ''
const FACEBOOK_PASSWORD = ''
const FACEBOOK_GROUP_ID = ''
const GMAIL_ADDRESS = ''
const GMAIL_PASSWORD = ''
const REFRESH_FREQUENCY = 10 //in minutes, if its too low, you'll get banned

let previousName = "";

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    secure: false, // true for 465, false for other ports
    auth: {
        user: GMAIL_ADDRESS,
        pass: GMAIL_PASSWORD
    }
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
        if (request.label === "fbgroup") {

            const currentName = await page.locator("//div[@role='feed']/div[2]//strong[1]/span").nth(0).textContent();
            log.info(`Current top post is from '${currentName}'`);

            if (previousName !== currentName) {
                log.info(`NEW POST from ${currentName}` );
                previousName = currentName || "";

                const link = await page.locator("//div[@role='feed']/div[2]//a").nth(3).getAttribute("href");
                await page.locator("//div[@role='feed']/div[2]").nth(0).screenshot({ path: 'screenshot.png' });

                // email
                try {
                    await transporter.sendMail({
                        from: '"Message bot"<your@gmail.com>',
                        to: GMAIL_ADDRESS,
                        subject: `NEW LISTING FROM ${currentName}`,
                        html: `<a href="${link}"><img src="cid:screenshot"></a>`,
                        attachments: [{
                            filename: 'screenshot.png',
                            path: 'screenshot.png',
                            cid: 'screenshot'
                        }]
                    })
                } catch (err) {
                    console.log(err)
                }

            }
            
            await delay(REFRESH_FREQUENCY * 1000 * 60);
            await enqueueLinks({
                urls: [`http://www.facebook.com/groups/${FACEBOOK_GROUP_ID}/?sorting_setting=CHRONOLOGICAL`],
                label: "fbgroup",
                transformRequestFunction: (request) => {
                    request.uniqueKey = `${request.url}:${uuidv4()}`;
                    return request;
                }
                
            });

        } else {
            //auth section
            const title = await page.title();
            log.info(`Title of ${request.loadedUrl} is '${title}'`);

            await page.getByTestId('cookie-policy-manage-dialog-accept-button').nth(0).click();
            await page.fill('input[name="email"]', FACEBOOK_USERNAME);
            await page.fill('input[name="pass"]', FACEBOOK_PASSWORD);
            await page.click('button[name="login"]');
            // page.getByRole("search");
            // page.locator("button[aria-label='Messenger']")
            await delay(10000)
            await enqueueLinks({
                urls: [`http://www.facebook.com/groups/${FACEBOOK_GROUP_ID}/?sorting_setting=CHRONOLOGICAL`],
                label: "fbgroup"
            });
        }
    },
    requestHandlerTimeoutSecs:REFRESH_FREQUENCY*60*5,
    statusMessageLoggingInterval:12*60*60,
    // Uncomment this option to see the browser window.
    // headless: false,
    
});
crawler
await crawler.run(['http://www.facebook.com']);
