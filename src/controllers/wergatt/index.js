import { appRouter } from '../../components/appRouter';

const LOCAL_FILES = false;

const ALLOWED_PATH = '/wergatt';

const FRAME_ORIGIN = LOCAL_FILES ? 'http://localhost:8080' : 'http://localhost:3001';

/** Updates the URL params, avoiding any build in routing */
function updateParams(newParams) {
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
    if (data.doneLoading) {
        console.log('Child is done loading!');
    }
    if (data.routeChangeTo) {
        console.log(`Route changed to: ${data.routeChangeTo}`);
        updateParams({path: data.routeChangeTo});
    }
}

export default function (view, params) {
    window.addEventListener('message', onMessage, false);

    console.debug(params);
    const hostingFrame = view.querySelector('#wergattFrame');
    const keys = Object.keys(params);
    if (!keys.includes('redirect')) {
        keys.push('redirect');
    }
    const args = keys.map(key => `${key}=${params[key] ?? true}`);
    console.log('Frame loaded:', hostingFrame !== undefined);
    if (!LOCAL_FILES) {
        hostingFrame.setAttribute('src', `${FRAME_ORIGIN}/index.html?${args.join('&')}`);
    } else {
        hostingFrame.setAttribute('src', `${FRAME_ORIGIN}/wergatt/index.html?${args.join('&')}`);
    }
}
