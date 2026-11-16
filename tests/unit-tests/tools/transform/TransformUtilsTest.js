describe("TransformUtils suite", function() {
  var A = '#000000';
  var B = '#ff0000';
  var O = Constants.TRANSPARENT_COLOR;

  var HORIZONTAL = pskl.tools.transform.TransformUtils.HORIZONTAL;
  var VERTICAL = pskl.tools.transform.TransformUtils.VERTICAL;

  var CLOCKWISE = pskl.tools.transform.TransformUtils.CLOCKWISE;
  var COUNTERCLOCKWISE = pskl.tools.transform.TransformUtils.COUNTERCLOCKWISE;

  // shortcuts
  var frameEqualsGrid = test.testutils.frameEqualsGrid;
  var toFrameGrid = test.testutils.toFrameGrid;

  /*******************************/
  /************ FLIP *************/
  /*******************************/

  it("flips a frame vertically", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [O, B]
    ]));

    // should have flipped
    pskl.tools.transform.TransformUtils.flip(frame, VERTICAL);
    frameEqualsGrid(frame, [
      [O, A],
      [B, O]
    ]);
  });

  it("flips a frame horizontally", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [O, B]
    ]));

    // should have flipped
    pskl.tools.transform.TransformUtils.flip(frame, HORIZONTAL);
    frameEqualsGrid(frame, [
      [O, B],
      [A, O]
    ]);
  });

  it("flips rectangular frame", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [A, O],
      [A, O]
    ]));

    // should have flipped
    pskl.tools.transform.TransformUtils.flip(frame, VERTICAL);
    frameEqualsGrid(frame, [
      [O, A],
      [O, A],
      [O, A]
    ]);

    // should be the same
    pskl.tools.transform.TransformUtils.flip(frame, HORIZONTAL);
    frameEqualsGrid(frame, [
      [O, A],
      [O, A],
      [O, A]
    ]);
  });

  /*******************************/
  /*********** ROTATE ************/
  /*******************************/

  it("rotates a frame counterclockwise", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [O, B]
    ]));

    // rotate once
    pskl.tools.transform.TransformUtils.rotate(frame, COUNTERCLOCKWISE);
    frameEqualsGrid(frame, [
      [O, B],
      [A, O]
    ]);

    // rotate twice
    pskl.tools.transform.TransformUtils.rotate(frame, COUNTERCLOCKWISE);
    frameEqualsGrid(frame, [
      [B, O],
      [O, A]
    ]);

    // rotate 3
    pskl.tools.transform.TransformUtils.rotate(frame, COUNTERCLOCKWISE);
    frameEqualsGrid(frame, [
      [O, A],
      [B, O]
    ]);

    // rotate 4 - back to initial state
    pskl.tools.transform.TransformUtils.rotate(frame, COUNTERCLOCKWISE);
    frameEqualsGrid(frame, [
      [A, O],
      [O, B]
    ]);
  });

  it("rotates a frame clockwise", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [O, B]
    ]));

    // rotate once
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, A],
      [B, O]
    ]);

    // rotate twice
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [B, O],
      [O, A]
    ]);

    // rotate 3
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, B],
      [A, O]
    ]);

    // rotate 4 - back to initial state
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [A, O],
      [O, B]
    ]);
  });

  it("rotates a rectangular frame", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, O],
      [A, O],
      [B, O],
      [B, O]
    ]));

    // rotate once
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O],
      [B, A],
      [O, O],
      [O, O]
    ]);

    // rotate twice
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O],
      [O, B],
      [O, A],
      [O, O]
    ]);

    // rotate 3
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O],
      [O, O],
      [A, B],
      [O, O]
    ]);

    // rotate 4
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O],
      [A, O],
      [B, O],
      [O, O]
    ]);
  });

  it("rotates a rectangular (horizontal) frame", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [O, O, O, O],
      [A, A, B, B]
    ]));

    // rotate once
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, A, O, O],
      [O, B, O, O]
    ]);

    // rotate twice
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, B, A, O],
      [O, O, O, O]
    ]);

    // rotate 3
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O, B, O],
      [O, O, A, O]
    ]);

    // rotate 4
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, O, O, O],
      [O, A, B, O]
    ]);
  });

  /*******************************/
  /*********** ROTATE 45 *********/
  /*******************************/

  it("rotates 45 degrees counterclockwise with exact palette colors", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O],
      [O, A, O],
      [O, O, B]
    ]));

    expect(pskl.tools.transform.TransformUtils.rotate45(frame, COUNTERCLOCKWISE)).toBe(frame);
    frameEqualsGrid(frame, [
      [B, O, O],
      [A, A, B],
      [O, O, O]
    ]);
  });

  it("rotates 45 degrees clockwise with exact palette colors", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O],
      [O, A, O],
      [O, O, B]
    ]));

    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [O, A, B],
      [O, A, O],
      [O, B, O]
    ]);
  });

  it("clips a 45 degree rotation of an even rectangular frame", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, A, A, A, A, A],
      [A, A, A, A, A, A]
    ]));

    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    expect(frame.getWidth()).toBe(6);
    expect(frame.getHeight()).toBe(2);
    frameEqualsGrid(frame, [
      [O, A, A, A, O, O],
      [O, O, A, A, A, O]
    ]);
  });

  it("keeps a single semi-transparent pixel unchanged", function () {
    var color = "rgba(255, 0, 0, 0.5)";
    var frame = pskl.model.Frame.fromPixelGrid([[color]]);
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    frameEqualsGrid(frame, [[color]]);
  });

  it("keeps empty frames transparent when rotating 45 degrees", function () {
    var frame = new pskl.model.Frame(4, 6);
    pskl.tools.transform.TransformUtils.rotate45(frame, COUNTERCLOCKWISE);
    frame.forEachPixel(function (color) {
      test.testutils.colorEqualsColor(color, O);
    });
  });

  [CLOCKWISE, COUNTERCLOCKWISE].forEach(function (direction) {
    it("keeps quarter and half turns exact after repeated 45 degree rotations " + direction, function () {
      var original = pskl.model.Frame.fromPixelGrid(toFrameGrid([
        [O, O, O, O, O, O],
        [O, A, A, A, A, O],
        [O, A, O, O, B, O],
        [O, A, A, B, B, O],
        [O, O, O, O, O, O],
        [O, O, O, O, O, O]
      ]));
      var frame = original.clone();
      var expected = original.clone();
      for (var step = 1; step <= 8; step++) {
        pskl.tools.transform.TransformUtils.rotate45(frame, direction);
        if (step % 2 === 0) {
          pskl.tools.transform.TransformUtils.rotate(expected, direction);
          expect(frame.getPixels()).toEqual(expected.getPixels());
        }
      }
      expect(frame.getPixels()).toEqual(original.getPixels());
    });
  });

  it("restores the original pixels when a 45 degree turn is reversed", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O],
      [O, A, O],
      [O, O, B]
    ]));
    var pixels = frame.getPixels();
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    pskl.tools.transform.TransformUtils.rotate45(frame, COUNTERCLOCKWISE);
    expect(frame.getPixels()).toEqual(pixels);
  });

  it("recovers clipped rectangular content at 180 and 360 degrees", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, A, A, B, B, B],
      [A, A, A, B, B, B]
    ]));
    for (var step = 1; step <= 8; step++) {
      pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
      if (step === 4) {
        frameEqualsGrid(frame, [[B, B, B, A, A, A], [B, B, B, A, A, A]]);
      }
    }
    frameEqualsGrid(frame, [[A, A, A, B, B, B], [A, A, A, B, B, B]]);
  });

  it("uses edited pixels as the new rotation source", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O],
      [O, A, O],
      [O, O, B]
    ]));
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    frame.setPixel(0, 0, B);
    var edited = frame.clone();
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    pskl.tools.transform.TransformUtils.rotate45(edited, CLOCKWISE);
    expect(frame.getPixels()).toEqual(edited.getPixels());
  });

  it("combines the 45 and 90 degree tools without resampling earlier turns", function () {
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O],
      [O, A, O],
      [O, O, B]
    ]));
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    pskl.tools.transform.TransformUtils.rotate(frame, CLOCKWISE);
    pskl.tools.transform.TransformUtils.rotate45(frame, CLOCKWISE);
    frameEqualsGrid(frame, [
      [B, O, O],
      [O, A, O],
      [O, B, A]
    ]);
  });

  /*******************************/
  /*********** CENTER ************/
  /*******************************/

  it("centers a frame", function () {
    // create frame
    var frame = pskl.model.Frame.fromPixelGrid(toFrameGrid([
      [A, B, O, O],
      [B, A, O, O],
      [O, O, O, O],
      [O, O, O, O]
    ]));

    // should be centered
    pskl.tools.transform.TransformUtils.center(frame);
    frameEqualsGrid(frame, [
      [O, O, O, O],
      [O, A, B, O],
      [O, B, A, O],
      [O, O, O, O]
    ]);
  });

});
