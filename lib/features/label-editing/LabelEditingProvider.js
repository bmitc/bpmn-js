'use strict';

var UpdateLabelHandler = require('./cmd/UpdateLabelHandler');

var LabelUtil = require('./LabelUtil');


var is = require('../../util/ModelUtil').is,
    isExpanded = require('../../util/DiUtil').isExpanded,
    assign = require('lodash/object/assign');


var MIN_BOUNDS = {
  width: 150,
  height: 50
};




function LabelEditingProvider(eventBus, canvas, directEditing, commandStack, elementFactory) {

  directEditing.registerProvider(this);
  commandStack.registerHandler('element.updateLabel', UpdateLabelHandler);

  // listen to dblclick on non-root elements
  eventBus.on('element.dblclick', function(event) {
    directEditing.activate(event.element);
  });

  // complete on followup canvas operation
  eventBus.on([ 'element.mousedown', 'drag.init', 'canvas.viewbox.changed' ], function(event) {
    directEditing.complete();
  });

  // cancel on command stack changes
  eventBus.on([ 'commandStack.changed' ], function() {
    directEditing.cancel();
  });


  // activate direct editing for activities and text annotations


  if ('ontouchstart' in document.documentElement) {
    // we deactivate automatic label editing on mobile devices
    // as it breaks the user interaction workflow

    // TODO(nre): we should temporarily focus the edited element here
    // and release the focused viewport after the direct edit operation is finished
  } else {
    eventBus.on('create.end', 500, function(e) {

      var element = e.shape,
          canExecute = e.context.canExecute;

      if (!canExecute) {
        return;
      }

      if (is(element, 'bpmn:Task') || is(element, 'bpmn:TextAnnotation') ||
          (is(element, 'bpmn:SubProcess') && !isExpanded(element))) {

        directEditing.activate(element);
      }
    });
  }

  this._canvas = canvas;
  this._commandStack = commandStack;
  this._elementFactory = elementFactory;
}

LabelEditingProvider.$inject = [ 'eventBus', 'canvas', 'directEditing', 'commandStack', 'elementFactory' ];

module.exports = LabelEditingProvider;

var minScale = 1.2;

LabelEditingProvider.prototype.activate = function(element) {

  var text = LabelUtil.getLabel(element);

  if (text === undefined) {
    return;
  }

  var bbox = this.getEditingBBox(element);
  var options = {};

  var currentScale = this._canvas.zoom();
  options.scale = Math.max(minScale, currentScale);

  /*
  // adjust for expanded pools AND lanes
  if ((is(element, 'bpmn:Participant') && isExpanded(element)) || is(element, 'bpmn:Lane')) {
    bbox.width = MIN_BOUNDS.width;
    bbox.height = MIN_BOUNDS.height;

    bbox.x = bbox.x + 10 - bbox.width / 2;
    bbox.y = bbox.mid.y - bbox.height / 2;

  }

  // ajust minumum size for task and activities
  if ((is(element, 'bpmn:Task') || is(element, 'bpmn:Activity') )) {

    if (bbox.width < 100) {
      bbox.width = 100;
      bbox.x = bbox.mid.x - bbox.width / 2;
    }

    if (bbox.height < 80) {
      bbox.height = 80;
      bbox.y = bbox.mid.y - bbox.height / 2;
    }
  }

  // adjust for expanded sub processes and collapsed pools
  if ((is(element, 'bpmn:SubProcess') && isExpanded(element)) ||
    (is(element, 'bpmn:Participant') && !isExpanded(element))) {

    bbox.width = element.width;
    bbox.height = MIN_BOUNDS.height;

    bbox.x = bbox.mid.x - element.width / 2;
  }

  */
  // autosizing for TextAnnotation
  if (is(element, 'bpmn:TextAnnotation')) {
    options.autosizing = true;
    options.textAlignment = 'left';
    options.defaultHeight = this._elementFactory._getDefaultSize(element).height;
    options.maxHeight = 100;
  }

  // and external label
  if(element.label || element.type === 'label') {
    options.autosizing = true;
    options.defaultHeight = 50;
    options.maxHeight = 100;
  }

  return { bounds: bbox, text: text, options: options };
};


LabelEditingProvider.prototype.getEditingBBox_old = function(element) {

  var target = element.label || element;
  var bbox = this._canvas.getAbsoluteBBox(target);

  var currentScale = this._canvas.zoom();
  var scale = Math.max(minScale, scale);

  // if no connection, set scaled height, width
  if(!element.waypoints){
    bbox.width = target.width*currentScale;
    bbox.height = target.height*currentScale;
  }

  var mid = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };

  // external label
  if (target.labelTarget && scale == minScale) {
    var deltaX = (bbox.width - bbox.width*minScale) / 2;

    bbox.x = bbox.x + deltaX;
  }

  bbox.mid = mid;

  return bbox;
};

LabelEditingProvider.prototype.getEditingBBox = function(element){

  var target = element.label || element;
  var bbox = this._canvas.getAbsoluteBBox(target);

  var currentScale = this._canvas.zoom();
  var scale = Math.max(minScale, currentScale);

  // if no connection, set current height, width of element
  if(!element.waypoints){
    bbox.width = target.width;
    bbox.height = target.height;
  }

  // unabhängige Bounds
  // adjust for expanded pools AND lanes
  if ((is(element, 'bpmn:Participant') && isExpanded(element)) || is(element, 'bpmn:Lane')) {

    bbox.width = MIN_BOUNDS.width;
    bbox.height = MIN_BOUNDS.height;

    // center horizontally
    var poolHead = 30;
    var deltaX = (poolHead*currentScale - bbox.width*scale) / 2;
    bbox.x += deltaX;

    // and vertically
    var deltaY = (element.height*currentScale - bbox.height*scale) / 2;
    bbox.y += deltaY;
  }

  // adjust for expanded sub processes and collapsed pools
  if ((is(element, 'bpmn:SubProcess') && isExpanded(element)) ||
    (is(element, 'bpmn:Participant') && !isExpanded(element))) {

    bbox.height = MIN_BOUNDS.height;

    //center editing box
    var deltaX = (bbox.width*currentScale - bbox.width*scale) / 2
    bbox.x += deltaX;

  }

  //abhängige Bounds
  /**

  **/
  // external label
  if (target.labelTarget && scale == minScale) {
    var deltaX = (bbox.width*currentScale - bbox.width*minScale) / 2;

    bbox.x = bbox.x + deltaX;
  }

  var mid = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };

  bbox.mid = mid;

  return bbox;

  /*
  // ajust minumum size for task and activities
  if ((is(element, 'bpmn:Task') || is(element, 'bpmn:Activity') )) {

    if (bbox.width < 100) {
      bbox.width = 100;
      bbox.x = bbox.mid.x - bbox.width / 2;
    }

    if (bbox.height < 80) {
      bbox.height = 80;
      bbox.y = bbox.mid.y - bbox.height / 2;
    }
  }
  */


  /*
  // autosizing for TextAnnotation
  if (is(element, 'bpmn:TextAnnotation')) {
    options.autosizing = true;
    options.textAlignment = 'left';
    options.defaultHeight = this._elementFactory._getDefaultSize(element).height;
    options.maxHeight = 100;
  }

  // and external label
  if(element.label || element.type === 'label') {
    options.autosizing = true;
    options.defaultHeight = 50;
    options.maxHeight = 100;
  }
  */
}

LabelEditingProvider.prototype.update = function(element, newLabel, newSize) {
  var newBounds = {};

  var target = element.label || element;

  if(is(target, 'bpmn:TextAnnotation') || target.type === 'label'){
    assign(newBounds, {
      x: target.x,
      y: target.y,
      width: newSize.width,
      height: newSize.height
    });
  }
  else {
    newBounds = null;
  }

  this._commandStack.execute('element.updateLabel', {
    element: element,
    newLabel: newLabel,
    newBounds: newBounds
  });
};
