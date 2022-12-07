// ECMAScript 5 strict mode
"use strict";
var c = this.canvas;
		//ctx = c.getContext("2d");

/**
 * flood fill algorithm 
 * image_data is an array with pixel information as provided in canvas_context.data
 * (x, y) is starting point and color is the color used to replace old color
 */
function flood_fill(image_data, canvas_width, canvas_height, x, y, _color) {
	if (x<0 || x>canvas_width){		return;}
	if (y<0 || y>canvas_height){	return;}
		
	//convert color
	var color = $('<div></div>').css('background-color', _color).css('background-color');
	//alert(color);
    if(color == "transparent")
        color="rgb(0,0,0)";
    color=color.slice(4,-1).split(",");
    var components = 4; //rgba

    // unpack values
    var  fillColorR = color[0];
    var  fillColorG = color[1];
    var  fillColorB = color[2];

    // get start point
    var pixel_pos = (y*canvas_width + x) * components;
    var startR = image_data[pixel_pos];
    var startG = image_data[pixel_pos + 1];
    var startB = image_data[pixel_pos + 2];
    
    if(fillColorR==startR && fillColorG==startG && fillColorB==startB)
        return;  //prevent inf loop.

    function matchStartColor(pixel_pos) {
      return startR == image_data[pixel_pos] && 
             startG == image_data[pixel_pos+1] &&
             startB == image_data[pixel_pos+2];
    }

    function colorPixel(pixel_pos) {
      image_data[pixel_pos] = fillColorR;
      image_data[pixel_pos+1] = fillColorG;
      image_data[pixel_pos+2] = fillColorB;
      image_data[pixel_pos+3] = 255;
    }
    
    function trace(dir) {
        if(matchStartColor(pixel_pos + dir*components)) {
          if(!sides[dir]) {
            pixelStack.push([x + dir, y]);
            sides[dir]= true;
          }
        }
        else if(sides[dir]) {
          sides[dir]= false;
        }
    }

    var pixelStack = [[x, y]];

    while(pixelStack.length)
    {
      var newPos, x, y, pixel_pos, reachLeft, reachRight;
      newPos = pixelStack.pop();
      x = newPos[0];
      y = newPos[1];
      
      pixel_pos = (y*canvas_width + x) * components;
      while(y-- >= 0 && matchStartColor(pixel_pos))
      {
        pixel_pos -= canvas_width * components;
      }
      pixel_pos += canvas_width * components;
      ++y;

      var sides = [];
      sides[-1] = false;
      sides[1] = false;

      while(y++ < canvas_height-1 && matchStartColor(pixel_pos)) {
        colorPixel(pixel_pos);

        // left side
        if(x > 0) {
            trace(-1);
        }

        // right side
        if(x < canvas_width-1) { 
            trace(1);
        }
        pixel_pos += canvas_width * components;

      }
    }
}

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.c2canvas = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.c2canvas.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	
	};

	var typeProto = pluginProto.Type.prototype;

	

	typeProto.onCreate = function()
	{
		if (this.is_family)
			return;
		// Create the texture
		this.texture_img = new Image();
		this.texture_img.src = this.texture_file;
		this.texture_img.cr_filesize = this.texture_filesize;
		
		// Tell runtime to wait for this to load
		this.runtime.wait_for_textures.push(this.texture_img);
		
		//this.pattern = null;
		//this.webGL_texture = null;
		

	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;

		
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	var fxNames = [ "lighter",
					"xor",
					"copy",
					"destination-over",
					"source-in",
					"destination-in",
					"source-out",
					"destination-out",
					"source-atop",
					"destination-atop"];

	instanceProto.effectToCompositeOp = function(effect)
	{
		// (none) = source-over
		if (effect <= 0 || effect >= 11)
			return "source-over";
			
		// (none)|Additive|XOR|Copy|Destination over|Source in|Destination in|Source out|Destination out|Source atop|Destination atop
		return fxNames[effect - 1];	// not including "none" so offset by 1
	};
	
	instanceProto.updateBlend = function(effect)
	{
		var gl = this.runtime.gl;
		
		if (!gl)
			return;
			
		// default alpha blend
		this.srcBlend = gl.ONE;
		this.destBlend = gl.ONE_MINUS_SRC_ALPHA;
		
		switch (effect) {
		case 1:		// lighter (additive)
			this.srcBlend = gl.ONE;
			this.destBlend = gl.ONE;
			break;
		case 2:		// xor
			break;	// todo
		case 3:		// copy
			this.srcBlend = gl.ONE;
			this.destBlend = gl.ZERO;
			break;
		case 4:		// destination-over
			this.srcBlend = gl.ONE_MINUS_DST_ALPHA;
			this.destBlend = gl.ONE;
			break;
		case 5:		// source-in
			this.srcBlend = gl.DST_ALPHA;
			this.destBlend = gl.ZERO;
			break;
		case 6:		// destination-in
			this.srcBlend = gl.ZERO;
			this.destBlend = gl.SRC_ALPHA;
			break;
		case 7:		// source-out
			this.srcBlend = gl.ONE_MINUS_DST_ALPHA;
			this.destBlend = gl.ZERO;
			break;
		case 8:		// destination-out
			this.srcBlend = gl.ZERO;
			this.destBlend = gl.ONE_MINUS_SRC_ALPHA;
			break;
		case 9:		// source-atop
			this.srcBlend = gl.DST_ALPHA;
			this.destBlend = gl.ONE_MINUS_SRC_ALPHA;
			break;
		case 10:	// destination-atop
			this.srcBlend = gl.ONE_MINUS_DST_ALPHA;
			this.destBlend = gl.SRC_ALPHA;
			break;
		}	
	};

	instanceProto.onCreate = function()
	{
		this.visible = (this.properties[0] === 0);							// 0=visible, 1=invisible
		this.compositeOp = this.effectToCompositeOp(this.properties[1]);
		this.updateBlend(this.properties[1]);
		this.canvas = document.createElement('canvas');
		this.canvas.width=this.width;
		this.canvas.height=this.height;
		this.ctx = this.canvas.getContext('2d');
		this.ctx.drawImage(this.type.texture_img,0,0,this.width,this.height);
		this.toArrayBuffer = new ArrayBuffer();
		this.origin_point_path_x = 0 //propriedade de ponto de origem path x
		this.origin_point_path_y = 0 //propriedade de ponto de origem path y
		this.lastURLData = "";
		this.svgstr = "";
		

		
		//temporary canvas for layer pasting
		this.tCanvas = document.createElement('canvas');
		this.tCtx = this.tCanvas.getContext('2d');		
		
        this.update_tex = true;
		this.rcTex = new cr.rect(0, 0, 0, 0);
		//if (this.runtime.gl && !this.type.webGL_texture)
		//	this.type.webGL_texture = this.runtime.glwrap.loadTexture(this.type.texture_img, true, this.runtime.linearSampling);
	};
    
    // called whenever an instance is destroyed
	// note the runtime may keep the object after this call for recycling; be sure
	// to release/recycle/reset any references to other objects in this function.
	instanceProto.onDestroy = function ()
	{
	};
    
    // called when saving the full state of the game
	instanceProto.saveToJSON = function ()
	{
		// return a Javascript object containing information about your object's state
		// note you MUST use double-quote syntax (e.g. "property": value) to prevent
		// Closure Compiler renaming and breaking the save format
		return {
            "canvas_w":this.canvas.width,
            "canvas_h":this.canvas.height,
            "image":this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data
			// e.g.
			//"myValue": this.myValue
		};
	};
	
	// called when loading the full state of the game
	instanceProto.loadFromJSON = function (o)
	{
        var canvasWidth = this.canvas.width = o["canvas_w"];
        var canvasHeight = this.canvas.height = o["canvas_h"];
        var data = this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data;
        for (var y = 0; y < canvasHeight; ++y) {
            for (var x = 0; x < canvasWidth; ++x) {
                var index = (y * canvasWidth + x)*4;
                for (var c = 0; c < 4; ++c)
                data[index+c] = o["image"][index+c];
            }
        }
		// load from the state previously saved by saveToJSON
		// 'o' provides the same object that you saved, e.g.
		// this.myValue = o["myValue"];
		// note you MUST use double-quote syntax (e.g. o["property"]) to prevent
		// Closure Compiler renaming and breaking the save format
	};
	
	//helper function
	instanceProto.draw_instances = function (instances, ctx)
    {
        for(var x in instances)
        {
            if(instances[x].visible==false && this.runtime.testOverlap(this, instances[x])== false)
                continue;
            
            ctx.save();
            ctx.scale(this.canvas.width/this.width, this.canvas.height/this.height);
            ctx.rotate(-this.angle);
            ctx.translate(-this.bquad.tlx, -this.bquad.tly);
            ctx.globalCompositeOperation = instances[x].compositeOp;//rojo

			//alert(x);
            if (instances[x].type.pattern !== undefined && instances[x].type.texture_img !== undefined) {
                instances[x].pattern = ctx.createPattern(instances[x].type.texture_img, "repeat");                
            }

            instances[x].draw(ctx);
            ctx.restore();
        }
    };
	
	instanceProto.draw = function(ctx)
	{	
		ctx.save();
		
		ctx.globalAlpha = this.opacity;
		ctx.globalCompositeOperation = this.compositeOp;
		
		var myx = this.x;
		var myy = this.y;
		
		if (this.runtime.pixel_rounding)
		{
			myx = Math.round(myx);
			myy = Math.round(myy);
		}
		
		ctx.translate(myx, myy);
		ctx.rotate(this.angle);
				
		ctx.drawImage(this.canvas,
						  0 - (this.hotspotX * this.width),
						  0 - (this.hotspotY * this.height),
						  this.width,
						  this.height);
		
		ctx.restore();
	};

	instanceProto.drawGL = function(glw)
	{
		glw.setBlend(this.srcBlend, this.destBlend);
        if (this.update_tex)
        {
            if (this.tex)
                glw.deleteTexture(this.tex);
            this.tex=glw.loadTexture(this.canvas, false, this.runtime.linearSampling);
            this.update_tex = false;
        }
		glw.setTexture(this.tex);
		glw.setOpacity(this.opacity);

		var q = this.bquad;
		
		if (this.runtime.pixel_rounding)
		{
			var ox = Math.round(this.x) - this.x;
			var oy = Math.round(this.y) - this.y;
			
			glw.quad(q.tlx + ox, q.tly + oy, q.trx + ox, q.try_ + oy, q.brx + ox, q.bry + oy, q.blx + ox, q.bly + oy);
		}
		else
			glw.quad(q.tlx, q.tly, q.trx, q.try_, q.brx, q.bry, q.blx, q.bly);
	};




	//////////////////////////////////////
	// Conditions
	pluginProto.cnds = {};
	var cnds = pluginProto.cnds;
	
	cnds.OnAnyTIFFComplete = function () 
	{
	return true;
	};
	
	cnds.isPointInStrokeLastPath = function (x, y)
	{
		if(this.ctx.isPointInStroke(x, y)){ //check x and y point stay in stroke of last path
			
		return true
		}	
	}
	
	cnds.OnCanvasToSvgDataComplete = function () 
	{
	return true;
	};

	//////////////////////////////////////
	// Actions
	pluginProto.acts = {};
	var acts = pluginProto.acts;

	acts.SetEffect = function (effect)
	{	
		this.compositeOp = this.effectToCompositeOp(effect);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.DrawPoint = function (x,y, color)
	{	
		var ctx=this.ctx;
		ctx.fillStyle = color;
		ctx.fillRect(x,y,1,1);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.ResizeCanvas = function (width, height)
	{
		this.canvas.width=width;
		this.canvas.height=height;
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.PasteObject = function (object)
	{
		var ctx=this.ctx;
		this.update_bbox();
		
		var sol = object.getCurrentSol();
		var instances;
		if (sol.select_all)
			instances = sol.type.instances;
		else
			instances = sol.instances;
		
		this.draw_instances(instances, ctx);
		
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.PasteLayer = function (layer)
	{
		if (!layer || !layer.visible)
			return false;
    
		var ctx=this.ctx;
		this.update_bbox();
    
		//resize the temporary canvas to fit the size of the object
		this.tCanvas.width=this.canvas.width;
		this.tCanvas.height=this.canvas.height;
 
 		var t=this.tCtx;
    
		//clear the temporary canvas
		t.clearRect(0,0,this.tCanvas.width, this.tCanvas.height);
	
		this.draw_instances(layer.instances, t);
		
		//paste the temporary canvas into the real one
		ctx.drawImage(this.tCanvas,0,0,this.width,this.height);
			
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.DrawBox = function (x, y, width, height, color)
	{
		this.ctx.fillStyle = color;
		this.ctx.fillRect(x,y,width,height);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.DrawLine = function (x1, y1, x2, y2, color, line_width)
	{
		var ctx = this.ctx;
		ctx.strokeStyle = color;
		ctx.lineWidth = line_width;
		ctx.beginPath();  
		ctx.moveTo(x1,y1);
		ctx.lineTo(x2, y2); 
		ctx.stroke();
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.ClearCanvas = function ()
	{
		this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.FillColor = function (color)
	{
		this.ctx.fillStyle = color;
		this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.fillGradient = function (gradient_style, color1, color2)
	{
		var ctx = this.ctx;
		var w =this.canvas.width;
		var h=this.canvas.height;
		var gradient;
		
		switch(gradient_style)
		{
		case 0: //horizontal
			gradient = ctx.createLinearGradient(0,0,w,0);
			break;
		case 1: //vertical
			gradient = ctx.createLinearGradient(0,0,0,h);
			break;
		case 2: //diagonal_down_right
			gradient = ctx.createLinearGradient(0,0,w,h);
			break;
		case 3: //diagonal_down_left
			gradient = ctx.createLinearGradient(w,0,0,h);
			break;
		case 4: //radial
			gradient = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2, Math.sqrt(w*w+h*h)/2);
			break;
		}
        try{
            gradient.addColorStop(0, color1);
        }catch(e){
            gradient.addColorStop(0, "black");
        }
        try{
            gradient.addColorStop(1, color2);
        }catch(e){
            gradient.addColorStop(1, "black");
        }
		this.ctx.fillStyle = gradient;
		
		this.ctx.fillRect(0, 0, w, h);
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.beginPath = function ()
	{
		this.ctx.beginPath();
	};
	
	acts.drawPath = function (color, line_width)
	{
		var ctx = this.ctx;
		ctx.strokeStyle = color;
		ctx.lineWidth = line_width;
		ctx.stroke();
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.setLineSettings = function (line_cap, line_joint)
	{
		var ctx = this.ctx;
		ctx.lineCap = ["butt","round","square"][line_cap];
		ctx.lineJoin = ["round","bevel","milet"][line_joint];
	};
	
	acts.fillPath = function (color)
	{
		this.ctx.fillStyle = color;
		this.ctx.fill();
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.moveTo = function (x, y)
	{
		this.ctx.moveTo(x, y);
	};
	
	acts.lineTo = function (x, y)
	{
		this.ctx.lineTo(x, y);
	};
	
	acts.arc = function (x, y, radius, start_angle, end_angle, arc_direction)
	{
		this.ctx.arc(x, y, radius, cr.to_radians(start_angle), cr.to_radians(end_angle), arc_direction==1);
	};
	
	acts.drawCircle = function (x, y, radius, color, line_width)
	{
		var ctx = this.ctx;
		ctx.strokeStyle = color;
		ctx.lineWidth = line_width;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, cr.to_radians(360), true);  
		ctx.stroke();
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.bezierCurveTo = function (cp1x, cp1y, cp2x, cp2y, x, y)
	{
		this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	};
	
	acts.quadraticCurveTo = function (cpx, cpy, x, y)
	{
		this.ctx.quadraticCurveTo(cpx, cpy, x, y);
	};
	
	acts.rectPath = function (x, y, width, height)
	{
		this.ctx.rect(x,y,width,height);
	};
	
	acts.FloodFill= function (x,y,color)
	{
		var ctx = this.ctx;
		var I = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
		
		//flood_fill(I.data, this.canvas.width, this.canvas.height, x, y, [255, 0, 0]);
		//instanceProto.flood_fill(I.data, this.canvas.width, this.canvas.height, x, y, color);
		flood_fill(I.data, this.canvas.width, this.canvas.height, x, y, color);
		ctx.putImageData(I,0,0);
		
		this.runtime.redraw = true;
        this.update_tex = true;
	};
	
	acts.setLineDash = function (dash_width, space_width)
	{
		var dashArr = [dash_width, space_width];
		this.ctx.setLineDash(dashArr);
	};
	
	acts.RequestTIFFDataURL = function ()
	{
	let CanvasToTIFF={_dly:9,_error:null,setErrorHandler:function(a){this._error=a},toArrayBuffer:function(d,c,A){A=A||{};var x=this;try{var I=d.width,q=d.height,y=0,t=258,k=0,z=[],s,G="\x63\x61\x6e\x76\x61\x73\x2d\x74\x6f\x2d\x74\x69\x66\x66\x20\x30\x2e\x34\0",v=!!A.littleEndian,g=+(A.dpiX||A.dpi||96)|0,i=+(A.dpiY||A.dpi||96)|0,r=d.getContext("2d").getImageData(0,0,I,q),u=r.data.length,o=t+u,m=new ArrayBuffer(o),n=new Uint8Array(m),H=new DataView(m),C=0,e=new Date(),f;D(v?18761:19789);D(42);E(8);b();a(254,4,1,0);a(256,4,1,I);a(257,4,1,q);a(258,3,4,y,8);a(259,3,1,1);a(262,3,1,2);a(273,4,1,t,0);a(277,3,1,4);a(279,4,1,u);a(282,5,1,y,8);a(283,5,1,y,8);a(296,3,1,2);a(305,2,G.length,y,p(G));a(306,2,20,y,20);a(338,3,1,2);j();E(524296);E(524296);E(g);E(1);E(i);E(1);F(G);f=e.getFullYear()+":"+B(e.getMonth()+1)+":"+B(e.getDate())+" ";f+=B(e.getHours())+":"+B(e.getMinutes())+":"+B(e.getSeconds());F(f);n.set(r.data,t);setTimeout(function(){c(m)},x._dly)}catch(l){if(x._error){x._error(l.toString())}}function B(h){h+="";return h.length===1?"0"+h:h}function D(h){H.setUint16(C,h,v);C+=2}function E(h){H.setUint32(C,h,v);C+=4}function F(w){var h=0;while(h<w.length){H.setUint8(C++,w.charCodeAt(h++)&255,v)}if(C&1){C++}}function p(w){var h=w.length;return h&1?h+1:h}function a(J,K,h,L,w){D(J);D(K);E(h);if(w){y+=w;z.push(C)}if(h===1&&K===3&&!w){D(L);D(0)}else{E(L)}k++}function b(h){s=h||C;C+=2}function j(){H.setUint16(s,k,v);E(0);var h=14+k*12;for(var w=0,K,J;w<z.length;w++){K=z[w];J=H.getUint32(K,v);H.setUint32(K,J+h,v)}}},toBlob:function(b,a,c){this.toArrayBuffer(b,function(d){a(new Blob([d],{type:"image/tiff"}))},c||{})},toObjectURL:function(b,a,c){this.toBlob(b,function(d){var e=self.URL||self.webkitURL||self;a(e.createObjectURL(d))},c||{})},toDataURL:function(b,a,d){var c=this;c.toArrayBuffer(b,function(k){var j=new Uint8Array(k),g=1<<20,f=g,h="",e="",m=0,n=j.length;(function o(){while(m<n&&f-->0){h+=String.fromCharCode(j[m++])}if(m<n){f=g;setTimeout(o,c._dly)}else{m=0;n=h.length;f=180000;(function i(){e+=btoa(h.substr(m,f));m+=f;(m<n)?setTimeout(i,c._dly):a("data:image/tiff;base64,"+e)})()}})()},d||{})}};

  var self = this;
  CanvasToTIFF.toDataURL(this.canvas, function(url) {
     self.lastURLData = url; // this will make the url accessible with the LastDataURL expression
     self.runtime.trigger(cr.plugins_.c2canvas.prototype.cnds.OnAnyTIFFComplete, self); // this will call the trigger condition
	});
	};
	
	acts.drawSVGpath = function (pathSVG)
	{
		var path = new Path2D(pathSVG); //pathSVG this variable string inside form construct
		this.ctx.stroke(path);
	};


	
	acts.fillPattern = function(path_img) {
    const img = new Image()
    const ctx = this.ctx
    const self = this// quando o this é uma propriedade declarada fora da função se colocar o this ele não vai reconhecer o this, mas a primeira camada de um objeto. Ex: teste.objeto retorna o teste e nao o this

    img.src = path_img
    img.onload = function() {
        const  pattern = ctx.createPattern(img, 'repeat')
        ctx.fillStyle = pattern
        ctx.fill()
		self.runtime.redraw = true
		self.update_tex = true
    }
}

	acts.fillPatternEffect = function(path_img, effect) {
    const img = new Image()
    const ctx = this.ctx
    const self = this// quando o this é uma propriedade declarada fora da função se colocar o this ele não vai reconhecer o this, mas a primeira camada de um objeto. Ex: teste.objeto retorna o teste e nao o this

    img.src = path_img
    img.onload = function() {
		ctx.filter = effect
        const  pattern = ctx.createPattern(img, 'repeat')
        ctx.fillStyle = pattern
        ctx.fill()
		self.runtime.redraw = true
		self.update_tex = true
    }
}

	acts.MovePathWithTranslate = function(x, y){
		
	this.ctx.translate(x, y)
	}
	
	acts.ResetIdentityMatrix = function(){
		
	this.ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	
	acts.DrawImageNaturalSize = function(path_img,x, y){
	var self = this
	var ctx = this.ctx
	var img = new Image()
	img.src = path_img
    img.onload = function() {
	ctx.drawImage(img, x, y)
	self.runtime.redraw = true
	self.update_tex = true	
	}	
	}
	
	acts.DrawImageScaleSize = function(path_img,x, y, width, height){
	var self = this
	var ctx = this.ctx
	var img = new Image()
	img.src = path_img
    img.onload = function() {
	ctx.drawImage(img, x, y, width, height)
	self.runtime.redraw = true
	self.update_tex = true	
	}
	}
	
	acts.ClipPath = function(){
	var ctx = this.ctx
	ctx.clip()
	
	}	

	acts.RequestCanvasToSVGData = function(options){
	// api https://github.com/jankovicsandras/imagetracerjs/blob/master/imagetracer_v1.2.6.js
	(function(){"use strict";function n(){var n=this;this.versionnumber="1.2.6";this.imageToSVG=function(t,i,r){r=n.checkoptions(r);n.loadImage(t,function(t){i(n.imagedataToSVG(n.getImgdata(t),r))},r)};this.imagedataToSVG=function(t,i){i=n.checkoptions(i);var r=n.imagedataToTracedata(t,i);return n.getsvgstring(r,i)};this.imageToTracedata=function(t,i,r){r=n.checkoptions(r);n.loadImage(t,function(t){i(n.imagedataToTracedata(n.getImgdata(t),r))},r)};this.imagedataToTracedata=function(t,i){var r,f,u,o,e;if(i=n.checkoptions(i),r=n.colorquantization(t,i),i.layering===0)for(f={layers:[],palette:r.palette,width:r.array[0].length-2,height:r.array.length-2},u=0;u<r.palette.length;u++)o=n.batchtracepaths(n.internodes(n.pathscan(n.layeringstep(r,u),i.pathomit),i),i.ltres,i.qtres),f.layers.push(o);else{e=n.layering(r);i.layercontainerid&&n.drawLayers(e,n.specpalette,i.scale,i.layercontainerid);var s=n.batchpathscan(e,i.pathomit),h=n.batchinternodes(s,i),f={layers:n.batchtracelayers(h,i.ltres,i.qtres),palette:r.palette,width:t.width,height:t.height}}return f};this.optionpresets={"default":{corsenabled:!1,ltres:1,qtres:1,pathomit:8,rightangleenhance:!0,colorsampling:2,numberofcolors:16,mincolorratio:0,colorquantcycles:3,layering:0,strokewidth:1,linefilter:!1,scale:1,roundcoords:1,viewbox:!1,desc:!1,lcpr:0,qcpr:0,blurradius:0,blurdelta:20},posterized1:{colorsampling:0,numberofcolors:2},posterized2:{numberofcolors:4,blurradius:5},curvy:{ltres:.01,linefilter:!0,rightangleenhance:!1},sharp:{qtres:.01,linefilter:!1},detailed:{pathomit:0,roundcoords:2,ltres:.5,qtres:.5,numberofcolors:64},smoothed:{blurradius:5,blurdelta:64},grayscale:{colorsampling:0,colorquantcycles:1,numberofcolors:7},fixedpalette:{colorsampling:0,colorquantcycles:1,numberofcolors:27},randomsampling1:{colorsampling:1,numberofcolors:8},randomsampling2:{colorsampling:1,numberofcolors:64},artistic1:{colorsampling:0,colorquantcycles:1,pathomit:0,blurradius:5,blurdelta:64,ltres:.01,linefilter:!0,numberofcolors:16,strokewidth:2},artistic2:{qtres:.01,colorsampling:0,colorquantcycles:1,numberofcolors:4,strokewidth:0},artistic3:{qtres:10,ltres:10,numberofcolors:8},artistic4:{qtres:10,ltres:10,numberofcolors:64,blurradius:5,blurdelta:256,strokewidth:2},posterized3:{ltres:1,qtres:1,pathomit:20,rightangleenhance:!0,colorsampling:0,numberofcolors:3,mincolorratio:0,colorquantcycles:3,blurradius:3,blurdelta:20,strokewidth:0,linefilter:!1,roundcoords:1,pal:[{r:0,g:0,b:100,a:255},{r:255,g:255,b:255,a:255}]}};this.checkoptions=function(t){var r,i;for(t=t||{},typeof t=="string"&&(t=t.toLowerCase(),t=n.optionpresets[t]?n.optionpresets[t]:{}),r=Object.keys(n.optionpresets["default"]),i=0;i<r.length;i++)t.hasOwnProperty(r[i])||(t[r[i]]=n.optionpresets["default"][r[i]]);return t};this.colorquantization=function(t,i){var v=[],f=0,p,w,c,e=[],y=t.width*t.height,o,s,r,a,u,l,h;if(t.data.length<y*4){for(l=new Uint8ClampedArray(y*4),h=0;h<y;h++)l[h*4]=t.data[h*3],l[h*4+1]=t.data[h*3+1],l[h*4+2]=t.data[h*3+2],l[h*4+3]=255;t.data=l}for(s=0;s<t.height+2;s++)for(v[s]=[],o=0;o<t.width+2;o++)v[s][o]=-1;for(u=i.pal?i.pal:i.colorsampling===0?n.generatepalette(i.numberofcolors):i.colorsampling===1?n.samplepalette(i.numberofcolors,t):n.samplepalette2(i.numberofcolors,t),i.blurradius>0&&(t=n.blur(t,i.blurradius,i.blurdelta)),a=0;a<i.colorquantcycles;a++){if(a>0)for(r=0;r<u.length;r++)e[r].n>0&&(u[r]={r:Math.floor(e[r].r/e[r].n),g:Math.floor(e[r].g/e[r].n),b:Math.floor(e[r].b/e[r].n),a:Math.floor(e[r].a/e[r].n)}),e[r].n/y<i.mincolorratio&&a<i.colorquantcycles-1&&(u[r]={r:Math.floor(Math.random()*255),g:Math.floor(Math.random()*255),b:Math.floor(Math.random()*255),a:Math.floor(Math.random()*255)});for(o=0;o<u.length;o++)e[o]={r:0,g:0,b:0,a:0,n:0};for(s=0;s<t.height;s++)for(o=0;o<t.width;o++){for(f=(s*t.width+o)*4,c=0,w=1024,r=0;r<u.length;r++)p=(u[r].r>t.data[f]?u[r].r-t.data[f]:t.data[f]-u[r].r)+(u[r].g>t.data[f+1]?u[r].g-t.data[f+1]:t.data[f+1]-u[r].g)+(u[r].b>t.data[f+2]?u[r].b-t.data[f+2]:t.data[f+2]-u[r].b)+(u[r].a>t.data[f+3]?u[r].a-t.data[f+3]:t.data[f+3]-u[r].a),p<w&&(w=p,c=r);e[c].r+=t.data[f];e[c].g+=t.data[f+1];e[c].b+=t.data[f+2];e[c].a+=t.data[f+3];e[c].n++;v[s+1][o+1]=c}}return{array:v,palette:u}};this.samplepalette=function(n,t){for(var i,r=[],u=0;u<n;u++)i=Math.floor(Math.random()*t.data.length/4)*4,r.push({r:t.data[i],g:t.data[i+1],b:t.data[i+2],a:t.data[i+3]});return r};this.samplepalette2=function(n,t){for(var r,i,u=[],f=Math.ceil(Math.sqrt(n)),o=Math.ceil(n/f),s=t.width/(f+1),h=t.height/(o+1),e=0;e<o;e++)for(r=0;r<f;r++)if(u.length===n)break;else i=Math.floor((e+1)*h*t.width+(r+1)*s)*4,u.push({r:t.data[i],g:t.data[i+1],b:t.data[i+2],a:t.data[i+3]});return u};this.generatepalette=function(n){var u=[],t,f,e,o,r;if(n<8)for(o=Math.floor(255/(n-1)),r=0;r<n;r++)u.push({r:r*o,g:r*o,b:r*o,a:255});else{var i=Math.floor(Math.pow(n,1/3)),s=Math.floor(255/(i-1)),h=n-i*i*i;for(t=0;t<i;t++)for(f=0;f<i;f++)for(e=0;e<i;e++)u.push({r:t*s,g:f*s,b:e*s,a:255});for(t=0;t<h;t++)u.push({r:Math.floor(Math.random()*255),g:Math.floor(Math.random()*255),b:Math.floor(Math.random()*255),a:Math.floor(Math.random()*255)})}return u};this.layering=function(n){for(var u=[],r=0,c=n.array.length,l=n.array[0].length,a,e,v,o,s,y,h,p,i,t,f=0;f<n.palette.length;f++)for(u[f]=[],t=0;t<c;t++)for(u[f][t]=[],i=0;i<l;i++)u[f][t][i]=0;for(t=1;t<c-1;t++)for(i=1;i<l-1;i++)r=n.array[t][i],a=n.array[t-1][i-1]===r?1:0,e=n.array[t-1][i]===r?1:0,v=n.array[t-1][i+1]===r?1:0,o=n.array[t][i-1]===r?1:0,s=n.array[t][i+1]===r?1:0,y=n.array[t+1][i-1]===r?1:0,h=n.array[t+1][i]===r?1:0,p=n.array[t+1][i+1]===r?1:0,u[r][t+1][i+1]=1+s*2+p*4+h*8,o||(u[r][t+1][i]=2+h*4+y*8),e||(u[r][t][i+1]=0+v*2+s*4+8),a||(u[r][t][i]=0+e*2+4+o*8);return u};this.layeringstep=function(n,t){for(var u=[],f=n.array.length,e=n.array[0].length,r,i=0;i<f;i++)for(u[i]=[],r=0;r<e;r++)u[i][r]=0;for(i=1;i<f;i++)for(r=1;r<e;r++)u[i][r]=(n.array[i-1][r-1]===t?1:0)+(n.array[i-1][r]===t?2:0)+(n.array[i][r-1]===t?8:0)+(n.array[i][r]===t?4:0);return u};this.pointinpoly=function(n,t){for(var r=!1,i=0,u=t.length-1;i<t.length;u=i++)r=t[i].y>n.y!=t[u].y>n.y&&n.x<(t[u].x-t[i].x)*(n.y-t[i].y)/(t[u].y-t[i].y)+t[i].x?!r:r;return r};this.pathscan_combined_lookup=[[[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]],[[0,1,0,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[0,2,-1,0]],[[-1,-1,-1,-1],[-1,-1,-1,-1],[0,1,0,-1],[0,0,1,0]],[[0,0,1,0],[-1,-1,-1,-1],[0,2,-1,0],[-1,-1,-1,-1]],[[-1,-1,-1,-1],[0,0,1,0],[0,3,0,1],[-1,-1,-1,-1]],[[13,3,0,1],[13,2,-1,0],[7,1,0,-1],[7,0,1,0]],[[-1,-1,-1,-1],[0,1,0,-1],[-1,-1,-1,-1],[0,3,0,1]],[[0,3,0,1],[0,2,-1,0],[-1,-1,-1,-1],[-1,-1,-1,-1]],[[0,3,0,1],[0,2,-1,0],[-1,-1,-1,-1],[-1,-1,-1,-1]],[[-1,-1,-1,-1],[0,1,0,-1],[-1,-1,-1,-1],[0,3,0,1]],[[11,1,0,-1],[14,0,1,0],[14,3,0,1],[11,2,-1,0]],[[-1,-1,-1,-1],[0,0,1,0],[0,3,0,1],[-1,-1,-1,-1]],[[0,0,1,0],[-1,-1,-1,-1],[0,2,-1,0],[-1,-1,-1,-1]],[[-1,-1,-1,-1],[-1,-1,-1,-1],[0,1,0,-1],[0,0,1,0]],[[0,1,0,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[0,2,-1,0]],[[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]];this.pathscan=function(t,i){for(var s,p,w,o,r=[],u=0,h=0,f=0,e=0,b=t[0].length,k=t.length,a=0,v=!0,y=!1,l,c=0;c<k;c++)for(s=0;s<b;s++)if(t[c][s]==4||t[c][s]==11)for(f=s,e=c,r[u]={},r[u].points=[],r[u].boundingbox=[f,e,f,e],r[u].holechildren=[],v=!1,h=0,y=t[c][s]==11,a=1;!v;){if(r[u].points[h]={},r[u].points[h].x=f-1,r[u].points[h].y=e-1,r[u].points[h].t=t[e][f],f-1<r[u].boundingbox[0]&&(r[u].boundingbox[0]=f-1),f-1>r[u].boundingbox[2]&&(r[u].boundingbox[2]=f-1),e-1<r[u].boundingbox[1]&&(r[u].boundingbox[1]=e-1),e-1>r[u].boundingbox[3]&&(r[u].boundingbox[3]=e-1),l=n.pathscan_combined_lookup[t[e][f]][a],t[e][f]=l[0],a=l[1],f+=l[2],e+=l[3],f-1===r[u].points[0].x&&e-1===r[u].points[0].y)if(v=!0,r[u].points.length<i)r.pop();else{if(r[u].isholepath=y?!0:!1,y){for(p=0,w=[-1,-1,b+1,k+1],o=0;o<u;o++)!r[o].isholepath&&n.boundingboxincludes(r[o].boundingbox,r[u].boundingbox)&&n.boundingboxincludes(w,r[o].boundingbox)&&n.pointinpoly(r[u].points[0],r[o].points)&&(p=o,w=r[o].boundingbox);r[p].holechildren.push(u)}u++}h++}return r};this.boundingboxincludes=function(n,t){return n[0]<t[0]&&n[1]<t[1]&&n[2]>t[2]&&n[3]>t[3]};this.batchpathscan=function(t,i){var u=[];for(var r in t)t.hasOwnProperty(r)&&(u[r]=n.pathscan(t[r],i));return u};this.internodes=function(t,i){for(var f=[],o=0,e=0,s=0,h=0,c=0,u,r=0;r<t.length;r++)for(f[r]={},f[r].points=[],f[r].boundingbox=t[r].boundingbox,f[r].holechildren=t[r].holechildren,f[r].isholepath=t[r].isholepath,o=t[r].points.length,u=0;u<o;u++)e=(u+1)%o,s=(u+2)%o,h=(u-1+o)%o,c=(u-2+o)%o,i.rightangleenhance&&n.testrightangle(t[r],c,h,u,e,s)&&(f[r].points.length>0&&(f[r].points[f[r].points.length-1].linesegment=n.getdirection(f[r].points[f[r].points.length-1].x,f[r].points[f[r].points.length-1].y,t[r].points[u].x,t[r].points[u].y)),f[r].points.push({x:t[r].points[u].x,y:t[r].points[u].y,linesegment:n.getdirection(t[r].points[u].x,t[r].points[u].y,(t[r].points[u].x+t[r].points[e].x)/2,(t[r].points[u].y+t[r].points[e].y)/2)})),f[r].points.push({x:(t[r].points[u].x+t[r].points[e].x)/2,y:(t[r].points[u].y+t[r].points[e].y)/2,linesegment:n.getdirection((t[r].points[u].x+t[r].points[e].x)/2,(t[r].points[u].y+t[r].points[e].y)/2,(t[r].points[e].x+t[r].points[s].x)/2,(t[r].points[e].y+t[r].points[s].y)/2)});return f};this.testrightangle=function(n,t,i,r,u,f){return n.points[r].x===n.points[t].x&&n.points[r].x===n.points[i].x&&n.points[r].y===n.points[u].y&&n.points[r].y===n.points[f].y||n.points[r].y===n.points[t].y&&n.points[r].y===n.points[i].y&&n.points[r].x===n.points[u].x&&n.points[r].x===n.points[f].x};this.getdirection=function(n,t,i,r){return n<i?t<r?1:t>r?7:0:n>i?t<r?3:t>r?5:4:t<r?2:t>r?6:8};this.batchinternodes=function(t,i){var u=[];for(var r in t)t.hasOwnProperty(r)&&(u[r]=n.internodes(t[r],i));return u};this.tracepath=function(t,i,r){var e=0,s,o,u,f={};for(f.segments=[],f.boundingbox=t.boundingbox,f.holechildren=t.holechildren,f.isholepath=t.isholepath;e<t.points.length;){for(s=t.points[e].linesegment,o=-1,u=e+1;(t.points[u].linesegment===s||t.points[u].linesegment===o||o===-1)&&u<t.points.length-1;)t.points[u].linesegment!==s&&o===-1&&(o=t.points[u].linesegment),u++;u===t.points.length-1&&(u=0);f.segments=f.segments.concat(n.fitseq(t,i,r,e,u));e=u>0?u:t.points.length}return f};this.fitseq=function(t,i,r,u,f){var p,g;if(f>t.points.length||f<0)return[];var d=u,a=0,v=!0,h,c,s,l=f-u;l<0&&(l+=t.points.length);for(var it=(t.points[f].x-t.points[u].x)/l,rt=(t.points[f].y-t.points[u].y)/l,e=(u+1)%t.points.length,y;e!=f;)y=e-u,y<0&&(y+=t.points.length),h=t.points[u].x+it*y,c=t.points[u].y+rt*y,s=(t.points[e].x-h)*(t.points[e].x-h)+(t.points[e].y-c)*(t.points[e].y-c),s>i&&(v=!1),s>a&&(d=e,a=s),e=(e+1)%t.points.length;if(v)return[{type:"L",x1:t.points[u].x,y1:t.points[u].y,x2:t.points[f].x,y2:t.points[f].y}];p=d;v=!0;a=0;var o=(p-u)/l,w=(1-o)*(1-o),b=2*(1-o)*o,k=o*o,nt=(w*t.points[u].x+k*t.points[f].x-t.points[p].x)/-b,tt=(w*t.points[u].y+k*t.points[f].y-t.points[p].y)/-b;for(e=u+1;e!=f;)o=(e-u)/l,w=(1-o)*(1-o),b=2*(1-o)*o,k=o*o,h=w*t.points[u].x+b*nt+k*t.points[f].x,c=w*t.points[u].y+b*tt+k*t.points[f].y,s=(t.points[e].x-h)*(t.points[e].x-h)+(t.points[e].y-c)*(t.points[e].y-c),s>r&&(v=!1),s>a&&(d=e,a=s),e=(e+1)%t.points.length;return v?[{type:"Q",x1:t.points[u].x,y1:t.points[u].y,x2:nt,y2:tt,x3:t.points[f].x,y3:t.points[f].y}]:(g=p,n.fitseq(t,i,r,u,g).concat(n.fitseq(t,i,r,g,f)))};this.batchtracepaths=function(t,i,r){var u=[];for(var f in t)t.hasOwnProperty(f)&&u.push(n.tracepath(t[f],i,r));return u};this.batchtracelayers=function(t,i,r){var f=[];for(var u in t)t.hasOwnProperty(u)&&(f[u]=n.batchtracepaths(t[u],i,r));return f};this.roundtodec=function(n,t){return+n.toFixed(t)};this.svgpathstring=function(t,i,r,u){var c=t.layers[i],o=c[r],s="",f,h,e;if(u.linefilter&&o.segments.length<3)return s;if(s="<path "+(u.desc?'desc="l '+i+" p "+r+'" ':"")+n.tosvgcolorstr(t.palette[i],u)+'d="',u.roundcoords===-1){for(s+="M "+o.segments[0].x1*u.scale+" "+o.segments[0].y1*u.scale+" ",f=0;f<o.segments.length;f++)s+=o.segments[f].type+" "+o.segments[f].x2*u.scale+" "+o.segments[f].y2*u.scale+" ",o.segments[f].hasOwnProperty("x3")&&(s+=o.segments[f].x3*u.scale+" "+o.segments[f].y3*u.scale+" ");s+="Z "}else{for(s+="M "+n.roundtodec(o.segments[0].x1*u.scale,u.roundcoords)+" "+n.roundtodec(o.segments[0].y1*u.scale,u.roundcoords)+" ",f=0;f<o.segments.length;f++)s+=o.segments[f].type+" "+n.roundtodec(o.segments[f].x2*u.scale,u.roundcoords)+" "+n.roundtodec(o.segments[f].y2*u.scale,u.roundcoords)+" ",o.segments[f].hasOwnProperty("x3")&&(s+=n.roundtodec(o.segments[f].x3*u.scale,u.roundcoords)+" "+n.roundtodec(o.segments[f].y3*u.scale,u.roundcoords)+" ");s+="Z "}for(h=0;h<o.holechildren.length;h++){if(e=c[o.holechildren[h]],u.roundcoords===-1)for(s+=e.segments[e.segments.length-1].hasOwnProperty("x3")?"M "+e.segments[e.segments.length-1].x3*u.scale+" "+e.segments[e.segments.length-1].y3*u.scale+" ":"M "+e.segments[e.segments.length-1].x2*u.scale+" "+e.segments[e.segments.length-1].y2*u.scale+" ",f=e.segments.length-1;f>=0;f--)s+=e.segments[f].type+" ",e.segments[f].hasOwnProperty("x3")&&(s+=e.segments[f].x2*u.scale+" "+e.segments[f].y2*u.scale+" "),s+=e.segments[f].x1*u.scale+" "+e.segments[f].y1*u.scale+" ";else for(s+=e.segments[e.segments.length-1].hasOwnProperty("x3")?"M "+n.roundtodec(e.segments[e.segments.length-1].x3*u.scale)+" "+n.roundtodec(e.segments[e.segments.length-1].y3*u.scale)+" ":"M "+n.roundtodec(e.segments[e.segments.length-1].x2*u.scale)+" "+n.roundtodec(e.segments[e.segments.length-1].y2*u.scale)+" ",f=e.segments.length-1;f>=0;f--)s+=e.segments[f].type+" ",e.segments[f].hasOwnProperty("x3")&&(s+=n.roundtodec(e.segments[f].x2*u.scale)+" "+n.roundtodec(e.segments[f].y2*u.scale)+" "),s+=n.roundtodec(e.segments[f].x1*u.scale)+" "+n.roundtodec(e.segments[f].y1*u.scale)+" ";s+="Z "}if(s+='" />',u.lcpr||u.qcpr){for(f=0;f<o.segments.length;f++)o.segments[f].hasOwnProperty("x3")&&u.qcpr&&(s+='<circle cx="'+o.segments[f].x2*u.scale+'" cy="'+o.segments[f].y2*u.scale+'" r="'+u.qcpr+'" fill="cyan" stroke-width="'+u.qcpr*.2+'" stroke="black" />',s+='<circle cx="'+o.segments[f].x3*u.scale+'" cy="'+o.segments[f].y3*u.scale+'" r="'+u.qcpr+'" fill="white" stroke-width="'+u.qcpr*.2+'" stroke="black" />',s+='<line x1="'+o.segments[f].x1*u.scale+'" y1="'+o.segments[f].y1*u.scale+'" x2="'+o.segments[f].x2*u.scale+'" y2="'+o.segments[f].y2*u.scale+'" stroke-width="'+u.qcpr*.2+'" stroke="cyan" />',s+='<line x1="'+o.segments[f].x2*u.scale+'" y1="'+o.segments[f].y2*u.scale+'" x2="'+o.segments[f].x3*u.scale+'" y2="'+o.segments[f].y3*u.scale+'" stroke-width="'+u.qcpr*.2+'" stroke="cyan" />'),!o.segments[f].hasOwnProperty("x3")&&u.lcpr&&(s+='<circle cx="'+o.segments[f].x2*u.scale+'" cy="'+o.segments[f].y2*u.scale+'" r="'+u.lcpr+'" fill="white" stroke-width="'+u.lcpr*.2+'" stroke="black" />');for(h=0;h<o.holechildren.length;h++)for(e=c[o.holechildren[h]],f=0;f<e.segments.length;f++)e.segments[f].hasOwnProperty("x3")&&u.qcpr&&(s+='<circle cx="'+e.segments[f].x2*u.scale+'" cy="'+e.segments[f].y2*u.scale+'" r="'+u.qcpr+'" fill="cyan" stroke-width="'+u.qcpr*.2+'" stroke="black" />',s+='<circle cx="'+e.segments[f].x3*u.scale+'" cy="'+e.segments[f].y3*u.scale+'" r="'+u.qcpr+'" fill="white" stroke-width="'+u.qcpr*.2+'" stroke="black" />',s+='<line x1="'+e.segments[f].x1*u.scale+'" y1="'+e.segments[f].y1*u.scale+'" x2="'+e.segments[f].x2*u.scale+'" y2="'+e.segments[f].y2*u.scale+'" stroke-width="'+u.qcpr*.2+'" stroke="cyan" />',s+='<line x1="'+e.segments[f].x2*u.scale+'" y1="'+e.segments[f].y2*u.scale+'" x2="'+e.segments[f].x3*u.scale+'" y2="'+e.segments[f].y3*u.scale+'" stroke-width="'+u.qcpr*.2+'" stroke="cyan" />'),!e.segments[f].hasOwnProperty("x3")&&u.lcpr&&(s+='<circle cx="'+e.segments[f].x2*u.scale+'" cy="'+e.segments[f].y2*u.scale+'" r="'+u.lcpr+'" fill="white" stroke-width="'+u.lcpr*.2+'" stroke="black" />')}return s};this.getsvgstring=function(t,i){var r,u;i=n.checkoptions(i);var f=t.width*i.scale,e=t.height*i.scale,o="<svg "+(i.viewbox?'viewBox="0 0 '+f+" "+e+'" ':'width="'+f+'" height="'+e+'" ')+'version="1.1" xmlns="http://www.w3.org/2000/svg" desc="Created with imagetracer.js version '+n.versionnumber+'" >';for(r=0;r<t.layers.length;r++)for(u=0;u<t.layers[r].length;u++)t.layers[r][u].isholepath||(o+=n.svgpathstring(t,r,u,i));return o+"<\/svg>"};this.compareNumbers=function(n,t){return n-t};this.torgbastr=function(n){return"rgba("+n.r+","+n.g+","+n.b+","+n.a+")"};this.tosvgcolorstr=function(n,t){return'fill="rgb('+n.r+","+n.g+","+n.b+')" stroke="rgb('+n.r+","+n.g+","+n.b+')" stroke-width="'+t.strokewidth+'" opacity="'+n.a/255+'" '};this.appendSVGString=function(n,t){var i;t?(i=document.getElementById(t),i||(i=document.createElement("div"),i.id=t,document.body.appendChild(i))):(i=document.createElement("div"),document.body.appendChild(i));i.innerHTML+=n};this.gks=[[.27901,.44198,.27901],[.135336,.228569,.272192,.228569,.135336],[.086776,.136394,.178908,.195843,.178908,.136394,.086776],[.063327,.093095,.122589,.144599,.152781,.144599,.122589,.093095,.063327],[.049692,.069304,.089767,.107988,.120651,.125194,.120651,.107988,.089767,.069304,.049692]];this.blur=function(t,i,r){var o,s,f,w,u,l,a,v,y,h,e={width:t.width,height:t.height,data:[]},c,p;if(i=Math.floor(i),i<1)return t;for(i>5&&(i=5),r=Math.abs(r),r>1024&&(r=1024),c=n.gks[i-1],s=0;s<t.height;s++)for(o=0;o<t.width;o++){for(l=0,a=0,v=0,y=0,h=0,f=-i;f<i+1;f++)o+f>0&&o+f<t.width&&(u=(s*t.width+o+f)*4,l+=t.data[u]*c[f+i],a+=t.data[u+1]*c[f+i],v+=t.data[u+2]*c[f+i],y+=t.data[u+3]*c[f+i],h+=c[f+i]);u=(s*t.width+o)*4;e.data[u]=Math.floor(l/h);e.data[u+1]=Math.floor(a/h);e.data[u+2]=Math.floor(v/h);e.data[u+3]=Math.floor(y/h)}for(p=new Uint8ClampedArray(e.data),s=0;s<t.height;s++)for(o=0;o<t.width;o++){for(l=0,a=0,v=0,y=0,h=0,f=-i;f<i+1;f++)s+f>0&&s+f<t.height&&(u=((s+f)*t.width+o)*4,l+=p[u]*c[f+i],a+=p[u+1]*c[f+i],v+=p[u+2]*c[f+i],y+=p[u+3]*c[f+i],h+=c[f+i]);u=(s*t.width+o)*4;e.data[u]=Math.floor(l/h);e.data[u+1]=Math.floor(a/h);e.data[u+2]=Math.floor(v/h);e.data[u+3]=Math.floor(y/h)}for(s=0;s<t.height;s++)for(o=0;o<t.width;o++)u=(s*t.width+o)*4,w=Math.abs(e.data[u]-t.data[u])+Math.abs(e.data[u+1]-t.data[u+1])+Math.abs(e.data[u+2]-t.data[u+2])+Math.abs(e.data[u+3]-t.data[u+3]),w>r&&(e.data[u]=t.data[u],e.data[u+1]=t.data[u+1],e.data[u+2]=t.data[u+2],e.data[u+3]=t.data[u+3]);return e};this.loadImage=function(n,t,i){var r=new Image;i&&i.corsenabled&&(r.crossOrigin="Anonymous");r.onload=function(){var n=document.createElement("canvas"),i;n.width=r.width;n.height=r.height;i=n.getContext("2d");i.drawImage(r,0,0);t(n)};r.src=n};this.getImgdata=function(n){var t=n.getContext("2d");return t.getImageData(0,0,n.width,n.height)};this.specpalette=[{r:0,g:0,b:0,a:255},{r:128,g:128,b:128,a:255},{r:0,g:0,b:128,a:255},{r:64,g:64,b:128,a:255},{r:192,g:192,b:192,a:255},{r:255,g:255,b:255,a:255},{r:128,g:128,b:192,a:255},{r:0,g:0,b:192,a:255},{r:128,g:0,b:0,a:255},{r:128,g:64,b:64,a:255},{r:128,g:0,b:128,a:255},{r:168,g:168,b:168,a:255},{r:192,g:128,b:128,a:255},{r:192,g:0,b:0,a:255},{r:255,g:255,b:255,a:255},{r:0,g:128,b:0,a:255}];this.drawLayers=function(t,i,r,u){var c,l,e,o,s,f,h,a;r=r||1;u?(f=document.getElementById(u),f||(f=document.createElement("div"),f.id=u,document.body.appendChild(f))):(f=document.createElement("div"),document.body.appendChild(f));for(s in t)if(t.hasOwnProperty(s)){for(c=t[s][0].length,l=t[s].length,h=document.createElement("canvas"),h.width=c*r,h.height=l*r,a=h.getContext("2d"),o=0;o<l;o++)for(e=0;e<c;e++)a.fillStyle=n.torgbastr(i[t[s][o][e]%i.length]),a.fillRect(e*r,o*r,r,r);f.appendChild(h)}}}typeof define=="function"&&define.amd?define(function(){return new n}):typeof module!="undefined"?module.exports=new n:typeof self!="undefined"?self.ImageTracer=new n:window.ImageTracer=new n})();
	
	var self = this;
	self.svgstr = ImageTracer.imagedataToSVG( ImageTracer.getImgdata(this.canvas), options ) 
	{
	self.runtime.trigger(cr.plugins_.c2canvas.prototype.cnds.OnCanvasToSvgDataComplete, self); // criei este trigger, devido o tempo de resposta diferente dependendo da opcao escolhida
	}
	
	}
	
	acts.SetOriginPointPath = function (x,y)
	{
		this.origin_point_path_x = x
		this.origin_point_path_y = y
	}
	
	acts.SetOriginPointPathOnlyX = function (x)
	{
		this.origin_point_path_x = x
	
	}

	acts.SetOriginPointPathOnlyY = function (y)
	{
		this.origin_point_path_y = y
	
	}
	
	//////////////////////////////////////
	// Expressions
	pluginProto.exps = {};
	var exps = pluginProto.exps;
	
	exps.rgbaAt = function (ret, x, y)
	{
		var imageData= this.ctx.getImageData(x,y,1,1);
		var data= imageData.data;
		ret.set_string("rgba(" + data[0] + "," + data[1] + "," + data[2] + "," + data[3]/255 + ")");
	};
    
    exps.redAt = function (ret, x, y)
	{
		var imageData= this.ctx.getImageData(x,y,1,1);
		var data= imageData.data;
		ret.set_int(data[0]);
	};
    exps.greenAt = function (ret, x, y)
	{
		var imageData= this.ctx.getImageData(x,y,1,1);
		var data= imageData.data;
		ret.set_int(data[1]);
	};
    exps.blueAt = function (ret, x, y)
	{
		var imageData= this.ctx.getImageData(x,y,1,1);
		var data= imageData.data;
		ret.set_int(data[2]);
	};
    exps.alphaAt = function (ret, x, y)
	{
		var imageData= this.ctx.getImageData(x,y,1,1);
		var data= imageData.data;
		ret.set_int(data[3]*100/255);
	};
	
	exps.imageUrl = function (ret)
	{
		ret.set_string(this.canvas.toDataURL());
	};
    
    exps.AsJSON = function(ret)
    {
        ret.set_string( JSON.stringify({
			"c2array": true,
			"size": [1, 1, this.canvas.width * this.canvas.height * 4],
			"data": [[this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data]]
		}));
    };
	
	exps.LastTIFFDataURL = function (ret)
	{
		ret.set_string(this.lastURLData);
	};
	
	exps.CanvasSvgString = function (ret)
	{
		ret.set_string(this.svgstr);
	};
	
	exps.OriginPointPathX = function (ret)
	{
		ret.set_float(this.origin_point_path_x)
	};
	
	exps.OriginPointPathY = function (ret)
	{
		ret.set_float(this.origin_point_path_y)
	};

}());