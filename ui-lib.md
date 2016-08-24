# `ui-lib.jsfx-inc`: pretty UIs for REAPER's JS effects

```
import ui-lib-jsfx-inc

@init
...
membuffer_end = ui_setup(membuffer_start); // It needs some working memory

@gfx
ui_start("main"); // Default screen

ui_screen() == "main" ? (
	ui_text("Click me"); // Centres text in available space
	ui_click() ? (
		ui_screen_open("slider");
		ui_screen_set(0, 4.5); // Pass arguments between screens
	);
) : ui_screen() == "slider" ? (
	ui_split_top(50);
		ui_background(255, 255, 255);
		ui_border_bottom();
		ui_text("Title");
		// A "button" is composite component built from other elements
		ui_button("back") ? (
			ui_screen_close();
		);
	ui_pop();

	// Split the screen into three vertical sliders
	ui_split(3, 0); // split horizontally
	myvar1 = ui_vslider(myvar1, -1, 1, 1); // Linear between 0 and 1
	ui_split_next();
	myvar2 = ui_vslider(myvar2, 0, 100, 2); // Squared (so 10% filled means a value of 1%)
	ui_split_next();
	myvar3 = ui_vslider(myvar3, 1, 100, 0); // Logarithmic
	ui_split_next();
) : ui_system();
```

### `ui_setup(memstart)`

This must be called in `@init`.  It reserves a section of the memory buffer for use by the UI library.  It returns the next index that it is not using.

```
fft_buffer = 0;
fft_buffer_end = fft_buffer + 512;

safe_to_use = ui_setup(fft_buffer_end, 10, 10);

next_array_start = safe_to_use;
```

If you are not using the memory, buffer, then the first argument should be `0`.

## Screen management functions

### `ui_start(defaultScreen)`

This should be the first thing you call.  It resets the viewport, does some error-checking, detects clicks - generally important. :)

If the screen is not set, it is set to `defaultScreen`.

### `ui_screen()`

Gets the current screen ID.  You should check this to see what you should be drawing:

```
ui_start("main"); // Default screen

ui_screen() == "main" ? (
	...
) : ui_system();
```

Although there is a string in the above example, screen IDs are always compared numerically.  However, two identical string literals will be represented by the same numerical ID, it's a nice readable way to get a set of unique IDs.

You must *always* perform the `ui_screen()` check, even if you only have one screen, so that `ui_system()` can be used to display errors etc.

There are some built-in screen IDs which are handled by ui_system();

### `ui_screen_level()`

Returns how many screens are below this one in the stack

### `ui_system()`

This is the fallback function you must call if you have not rendered a screen.  It displays errors and other built-in screens.

You should always have this - since JSFX has no exceptions or error-handling, this is way you'll be informed if you tell the UI to do something nonsensical.

### `ui_screen_get(index)` and `ui_screen_set(index, value)`

Gets/sets the current screen argument at index `index`.

This is how screens can "call" each other with arguments.  You need a convention agreed between the screens about what the arguments are.  When a screen is opened, all arguments are set to 0.

```
ui_screen_open("say-hello");
ui_screen_set(0, "world");
ui_screen_set(1, 42);
```

If you want the screen to give you a result to a non-fixed location, then you need to pass in an array.  For example, a "integer-prompt" screen might take two arguments as the range, and the other as the memory index ("array") where the result should be placed.

```
// A text variable you're interested in
myarray[0] = 5; // default value

ui_screen_open("integer-prompt");
ui_screen_set(0, 1);
ui_screen_set(1, 10);
ui_screen_set(2, myarray);
```

## Viewport and stack operations

All drawing parameters (including the viewport, colours and alignment) are stored in a "stack".  Generally, you will made a modification that pushes a change onto the stack, and then pop it off afterwards.

Some operations (such as the `ui_split_*()` functions) both modify the existing level on the stack, *and* push a new layer to it.  This is often convenient - for example, if your UI has a side-bar, you can use `ui_split_right(100)` to push it onto the stack and draw within it, but when you `ui_pop()` afterwards, you are left with the *remaining* area (that is, the viewport has now shrunk so it doesn't include the side-bar).

### `ui_left()`, `ui_right()`, `ui_top()`, `ui_bottom()`, `ui_width()` and `ui_height()`

These return the dimensions of the current viewport - very useful if you need to draw your own stuff and want to know what the viewport is.

### `ui_pop()` (and `ui_push()`)

Pop a layer off the stack, or push a new layer (identical to the current one).

You probably don't need to use `ui_push()` directly - instead, many of the other functions call `ui_push()` as a side-effect.

### `ui_split_top(height)`, `ui_split_bottom(height)`, `ui_split_left(width)` and `ui_split_right(width)`

These perform two actions:

* Push a new layer onto the stack, with the viewport attached to the appropriate side
* Modify the existing layer (now second on the stack) so that it no longer includes the new section.

It's called "split" because the two layers on the stack are now non-overlapping.

```
ui_split_bottom(100);
	ui_fill(0, 128, 0);
	ui_text("footer");
ui_pop();
// Viewport is now everything *except* the footer
ui_fill(0, 0, 0); // Does not overwrite the footer
```

### `ui_split_topratio(ratio)`, etc.

These are the same as `ui_split_top()` etc., except instead of a pixel height you specify a ratio of the current viewport width/height.

### `ui_pad(pixels)`

This insets the current viewport by this much in each direction.

It does *not* change the stack.

## Graphics

These do not add or remove anything to the stack.  Instead, they modify the current drawing layer (and any later layers that inherit from it).

### `ui_fontsize(pixels)`, `ui_fontbold(isBold)` and `ui_fontitalic(isItalic)`

Changes properties of the font.

### `ui_align(halign, valign)`

Some operations (like text) need a horizontal/vertical alignment.  These are numbers between 0 and 1 representing the alignment - so `0` means "left" or "top", `0.5` is "centre", and `1` is "right" or "bottom".

The default alignment is `(0.5, 0.5)`, which is the middle.

### `ui_text(string)`

Renders a string aligned within the current element.

Returns the width of the rendered text;

### `ui_text_width(string)` and `ui_text_height(string)`

String width and height using the current font settings.

### `ui_wraptext(string)`

Renders wrapped text (breaks on whitespace), aligned within the current element.

Returns height of the rendered text.

### `ui_wraptext_height(string)`

Height of wrapped text using the current font settings.

### `ui_fill(r, b, g)`

Fills the current viewport with a solid colour.

This automatically sets the text colour to a contrasting one (black or white).

## Input

### `ui_mousedown()`

Returns whether the mouse was just clicked inside the current viewport.

### `ui_mouseup()`

Returns whether the mouse was just released inside the current viewport.

#### `ui_click_clear()`

You probably shouldn't have overlapping click regions - but if you do you can use `ui_click_clear()` to stop later code from detecting it.  No mouse-related functions will return true in later code.

### `ui_hover()`

Whether the mouse is currently inside the viewport.

Note: this returns true even if the mouse buttons are down or the user has clicked somewhere else and is dragging.

### `ui_press()`

Whether the mouse was originally clicked within this viewport, the button is still down and the user is hovering over this element.  It returns the time since the mouse was originally clicked.

Note: if the user holds the mouse down and drags outside the control and then back into it, this will return true.

### `ui_click()`

Whether this element was clicked.  It returns the duration of the click.

Note: this triggers on mouse-up (which also means that drag and press will return false at this point).  If you want mouse-down, use `ui_mousedown()`.

### `ui_drag()`

Whether this element was clicked before and the mouse is still down.  It returns the time since the mouse was originally clicked.

## Complex controls

These are controls implemented using the above functions.  They are opinionated - they have fixed colours and layouts.  However, they can be used to create a powerful UI more easily.

#### `control_button(text)`

Displays a button with text, and returns `true` if the button has just been clicked.

```
control_button("Go!") ? (
	do_something();
);
```