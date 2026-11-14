# vendor/

Third-party files stored locally so the Play tab works offline in a museum.

    mediapipe/vision_bundle.mjs      MediaPipe Tasks Vision 1.2.3 (Apache-2.0), from npm @mediapipe/tasks-vision
    mediapipe/wasm/                  its WebAssembly files, from the same npm package
    mediapipe/hand_landmarker.task   the HandLandmarker model (float16, 7,819,105 bytes)

## How to update them

    npm install @mediapipe/tasks-vision
    cp node_modules/@mediapipe/tasks-vision/vision_bundle.mjs vendor/mediapipe/
    cp node_modules/@mediapipe/tasks-vision/wasm/* vendor/mediapipe/wasm/
    curl -L -o vendor/mediapipe/hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Note: the model in this repo was copied from a mirror inside an npm package because Google's
download server was not reachable when it was added. Run the curl line above once to replace it
with Google's official copy (the size should stay 7,819,105 bytes).
