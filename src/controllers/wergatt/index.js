import { appRouter } from '../../components/appRouter';
import loading from '../../components/loading/loading';
import ServerConnections from '../../components/ServerConnections';
import { dashboardTheme, theme } from '../../scripts/settings/userSettings';
import { pageClassOn } from '../../utils/dashboard';

const LOCAL_FILES = false;

const ALLOWED_PATH = '/wergatt';

const FRAME_ORIGIN = LOCAL_FILES ? 'http://localhost:8080' : 'http://localhost:3001';

let wergattBox;

/** HTML Frame we're putting the website in */
let hostingFrame;

/** Cached string? of currently selected theme */
let cachedTheme;

let isHidden = false;

/** Params to send to the frame when its loaded */
let paramsOnLoad;

/** Height of the Box */
let boxHeight = 0;
/** Height of the frame */
let frameHeight = 0;

/** Updates the URL params, avoiding any build in routing */
function updateParams(newParams) {
    console.log('[WERGATT] Changing params to:', newParams);
    const path = appRouter.currentRouteInfo.route?.alias;
    // Only allow change displayed URL in allowed path
    if (path !== ALLOWED_PATH) {
        return;
    }

    const state = window.history?.state;
    const args = Object.keys(newParams).map(key => `${key}=${newParams[key]}`);
    window.history.replaceState(state, '', `#${ALLOWED_PATH}?${args.join('&')}`); // ,
}

/** Handling events from child iframe */
function onMessage(event) {
    // console.log(`Recieved event from: ${event.origin}`);
    if (event.origin !== FRAME_ORIGIN) {
        return;
    }
    const data = event.data;
    // Respond with init data, like credentials and style when we're done loading
    if (data.doneLoading) {
        console.log('[WERGATT] Child is done loading, sending infos:');
        const initData = {
            // TODO: Maybe find a better place to grab this from?
            creds: JSON.parse(localStorage.getItem('jellyfin_credentials')),
            theme: theme(),
            cTheme: cachedTheme,
            redirectTo: paramsOnLoad
        };
        paramsOnLoad = null;
        sendMessage(initData);
        // Unhide the frame since loading is done
        if (!isHidden) {
            loading.hide();
            hostingFrame.classList.remove('hide');
        }
    }
    if (data.routeChangeTo) {
        if (!isHidden) {
            console.log(`[WERGATT] Route changed to: ${data.routeChangeTo}`);
            updateParams({path: data.routeChangeTo});
        }
    }
    if (data.frameResize) {
        const height = data.frameResize.height;
        const width = data.frameResize.width;
        console.log(`Inner frame size: ${height} x ${width}`);
        frameHeight = height;
        updateFrameHeight();
    }
}

function sendMessage(content) {
    if (!hostingFrame) return;
    hostingFrame.contentWindow.postMessage(content, FRAME_ORIGIN);
}

// set the saved theme once a user authenticates
Events.on(ServerConnections, 'localusersignedin', () => {
    cachedTheme = theme();
});

pageClassOn('viewbeforeshow', 'page', function () {
    if (this.classList.contains('type-interior')) {
        cachedTheme = dashboardTheme();
    } else {
        cachedTheme = theme();
    }
});

function hideIFrame() {
    isHidden = true;
    console.log('[WERGATT] Hiding iFrame');
    hostingFrame.classList.add('hide');
    // un-hide y-scollbar in parent
    document.body.style = '';
}

function onViewbeforeshow() {
    showIFrame();
}

function showIFrame(path) {
    isHidden = false;
    console.log('[WERGATT] Showing iFrame again', path);
    hostingFrame.classList.remove('hide');
    if (path) {
        sendMessage({
            redirectTo: path
        });
    }
}

function updateBoxHeight() {
    wergattBox = document.getElementById('wergatt-content');
    const height = window.getComputedStyle(wergattBox, null).getPropertyValue('height');
    console.log(height);
    const parsed = Math.floor(parseInt(height, 10) + 5);
    boxHeight = parsed;
    updateFrameHeight();
}

function updateFrameHeight() {
    const combinedFrameHeight = boxHeight;
    // Yeah, there is a small border on tablet or smaller view at the top, but it doesnt seem like i can do much about it /shurg
    hostingFrame.style = `width: 100%; height: ${combinedFrameHeight}px; border: 0; padding-bottom: 0 !important; padding-top: 65px !important`;
    // hostingFrame.style.height = hostingFrame.contentWindow.document.documentElement.scrollHeight + 'px';
    // hostingFrame.style = 'width: 100%; height: max-content; border: 0';
}

export default function (view, params) {
    // Make sure we can hide the iFrame so it does not get un-rendered
    view.addEventListener('viewbeforehide', hideIFrame);
    // Make sure to show the frame in some cases again
    view.addEventListener('viewbeforeshow', onViewbeforeshow);

    view.addEventListener('viewshow', () => {
        console.log('viewShow');
        // Hide y-scollbar in parent
        document.body.style = 'overflow-y: hidden;';
    });

    const goodKeys = Object.keys(params).filter(key => params[key] !== '');
    const filteredParams = goodKeys.length > 0 ? {} : null;
    goodKeys.forEach(key => filteredParams[key] = params[key]);

    console.debug('[WERGATT] New view, params:', filteredParams);
    if (hostingFrame) {
        showIFrame(filteredParams);
    } else {
        console.log('[WERGATT] Creating new iFrame');
        loading.show();
        // Add listener for events from the iFrame
        window.addEventListener('message', onMessage, false);
        window.addEventListener('resize', updateBoxHeight, false);

        paramsOnLoad = filteredParams;
        const targetPath = FRAME_ORIGIN + (LOCAL_FILES ? '/wergatt/index.html' : '/index.html');

        hostingFrame = document.createElement('iframe');
        hostingFrame.id = 'wergattFrame';
        hostingFrame.src = targetPath;
        hostingFrame.classList.add('page', 'libraryPage', 'mainAnimatedPage', 'hide', 'noSecondaryNavPage');
        const documentBody = document.getElementById('reactRoot');
        documentBody.before(hostingFrame);
        updateBoxHeight();
    }

    // Update height of box on every view reload
}
