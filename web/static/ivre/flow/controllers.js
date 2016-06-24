/*
 * This file is part of IVRE.
 * Copyright 2011 - 2016 Pierre LALET <pierre.lalet@cea.fr>
 *
 * IVRE is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * IVRE is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public
 * License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with IVRE. If not, see <http://www.gnu.org/licenses/>.
 */

var graphUtils = angular.module('graphUtils', []);
var ivreWebUi = angular.module('ivreWebUi');

ivreWebUi.directive("sigmaGraph", function () {
    var default_sigma_settings = {
        //scalingMode: "inside",
        autoCurveSortByDirection: true,
        //labelAlignment: "inside",
        singleHover: true,

        defaultLabelColor: "#ccc",
        labelColor: "default",
        labelThreshold: 8,

        defaultNodeColor: '#666',
        defaultNodeHoverColor: '#c00',
        nodeHoverColor: 'default',
        //borderSize: 10,

        defaultEdgeColor: '#ccc',
        defaultEdgeHoverColor: '#c00',
        edgeColor: 'default',
        edgeHoverColor: 'default',

        minNodeSize: 3,
        maxNodeSize: 5,
        minEdgeSize: 1,
        maxEdgeSize: 1,
        enableEdgeHovering: true,
        edgeHoverExtremities: true,
        edgeHoverSizeRatio: 1,

        batchEdgesDrawing: true,
        //hideEdgesOnMove: true,
        //drawLabels: false,
        drawEdgeLabels: false,
        animationsTime: 5000,

        nodeHaloColor: '#444444',
        edgeHaloColor: '#444444',
        nodeHaloSize: 10,
        edgeHaloSize: 5,
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            var on_load = attrs.onLoad;

            var s = new sigma({
                renderer: {
                    container: element[0].id,
                    type: 'canvas'
                },
                settings: default_sigma_settings,
            });

            // Instanciate the ActiveState plugin:
            var activeState = sigma.plugins.activeState(s);

            // Initialize the dragNodes plugin:
            var dragListener = sigma.plugins.dragNodes(s, s.renderers[0], activeState);

            // Initialize the Select plugin:
            var select = sigma.plugins.select(s, activeState);

            // Initialize the Keyboard plugin:
            var keyboard = sigma.plugins.keyboard(s, s.renderers[0]);

            // Bind the Keyboard plugin to the Select plugin:
            select.bindKeyboard(keyboard);

            sigma.canvas.edges.autoCurve(s)

            scope[attrs.sigma] = s;
            scope.$eval(on_load);
        }
    };
});

ivreWebUi.directive("graphRightClick", function () {
    return {
        restrict: "E",
        templateUrl: "templates/graph-right-click.html",
    };
});

ivreWebUi.directive("eltDetails", function () {
    return {
        restrict: "E",
        templateUrl: "templates/subview-graph-elt-details.html",
    };
});

ivreWebUi.factory("graphService", function () {
    node_colors = {
        "Host": ["#666", "#ddd"],
        "Mac": ["#066", "#0dd"],
    }

    // http://stackoverflow.com/questions/7616461
    function hashCode(s){
        return s.split("").reduce(function(a,b){
            a=((a<<5)-a)+b.charCodeAt(0);
            return a&a
        },0);              
    }

    function str_to_color(str) {
        return sigma.plugins.colorbrewer.Paired[8][hashCode(str) % 8];
    }


    // formatters is an object:
    // { edges: { attr: function }, nodes: { attr: function }}
    function update_display(s, formatters, filters) {
        filters = filters || {};
        if (formatters === undefined) {
            formatters = {nodes: {}, edges: {}};
        }

        // Patch edges for display
        s.graph.edges().forEach(function (edge) {
            if (edge.labels[0] === "Flow") {
                var n = 8,
                    port = edge.data.dport,
                    proto = edge.data.proto,
                    palette = {
                        udp: sigma.plugins.colorbrewer.Paired,
                        tcp: sigma.plugins.colorbrewer.Dark2,
                        other: sigma.plugins.colorbrewer.Spectral,
                    };

                if (proto in palette) {
                    key = proto;
                } else {
                    key = "other";
                }

                if (typeof port === "undefined") {
                    port = hashCode(proto);
                }

                edge.color = palette[key][n][port % n];
            } else {
                edge.color = str_to_color(edge.labels[0]);
            }
            //edge.type = "arrow";
            edge.type = "curvedArrow";

            filt = filters.edges
            if (filt !== undefined) {
                edge.hidden = !filt(edge);
            } else {
                edge.hidden = false;
            }

            fmt = formatters.edges;
            for (var key in fmt) {
                tmp = fmt[key](s, edge);
                if (tmp !== undefined) {
                    edge[key] = tmp;
                }
            }
        });

        // Patch nodes for display
        s.graph.nodes().forEach(function (node) {
            in_degree = s.graph.degree(node.id, "in");
            //node.size = in_degree;
            color_panel = node_colors[node.labels[0]];
            if (color_panel !== undefined) {
                node.color = color_panel[in_degree?1:0];
            } else {
                node.color = str_to_color(node.labels[0] || "");
            }

            filt = filters.nodes
            if (filt !== undefined) {
                node.hidden = !filt(node);
            } else {
                node.hidden = false;
            }

            fmt = formatters.nodes;
            for (var key in fmt) {
                tmp = fmt[key](s, node);
                if (tmp !== undefined) {
                    node[key] = tmp;
                }
            }
        });
        sigma.canvas.edges.autoCurve(s);
        s.refresh();
    };

    function update_layout(s) {
        // Possible layouts and config
        var fa = sigma.layouts.configForceLink(s, {
            worker: true,
            autoStop: true,
            background: true,
            barnesHutOptimize: false,
            scaleRatio: 10,
            gravity: 3,
            easing: 'cubicInOut'
        });

        var frListener = sigma.layouts.fruchtermanReingold.configure(s, {
            iterations: 200,
            easing: 'quadraticInOut',
            duration: 1000,
            //speed: 1,
        });

        var forceAtlasConfig = {
            //strongGravityMode: true,
            adjustSizes: true,
            iterationsPerRender: 10,
            barnesHutOptimize: true,
            linLogMode: true,
            worker: true,
        };
        //s.startForceAtlas2(forceAtlasConfig);
        //sigma.layouts.startForceLink();
        sigma.layouts.fruchtermanReingold.start(s);
    }

    // Post instanciation sigma conf
    function setup(s, formatters, filters) {
        update_display(s, formatters, filters);
        console.log("Nodes: " + s.graph.nodes().length);
        update_layout(s);

        s.refresh();
    }

    function render_halo(s) {
      s.renderers[0].halo({
        nodes: s.graph.nodes()
      });
    };

    // Inspired from linkurious example plugin-halo.html
    function set_halo(s, nodes, edges) {
        var adjacentNodes = nodes,
            adjacentEdges = edges;

        // Get adjacent nodes
        nodes.forEach(function(node) {
            adjacentNodes = adjacentNodes.concat(s.graph.adjacentNodes(node.id));
        });

        // Get adjacent edges
        nodes.forEach(function(node) {
            adjacentEdges = adjacentEdges.concat(s.graph.adjacentEdges(node.id));
        });

        // Get source and destination of hovered edge
        edges.forEach(function(edge) {
            adjacentNodes = adjacentNodes.concat(
                    s.graph.nodes([edge.source, edge.target]));
        });

        // Render halo
        s.renderers[0].halo({
            nodes: adjacentNodes,
            edges: adjacentEdges
        });
    };

    function enable_halo(s) {
        s.bind('hovers', function(e) {
            set_halo(s, e.data.enter.nodes, e.data.enter.edges);
        });
    };

    function has_details(s, elt) {
        return elt === undefined || elt.has_details === true;
    };

    function add_details(s, elt, data) {
        elt.has_details = true;
        if ($.inArray("Host", elt.labels) >= 0) {
            delete(data["elt"]);
            elt.details = data;
        } else if ($.inArray("Flow", elt.labels) >= 0) {
            delete(data["elt"]);
            elt.details = data;
        } else {
            console.log("Unsupported details format for " + elt.labels);
        }
    };

    return {
        update_display: update_display,
        setup: setup,
        update_layout: update_layout,
        enable_halo: enable_halo,
        has_details: has_details,
        add_details: add_details,
    };
});


ivreWebUi
    .controller('IvreFlowCtrl', function ($scope, $http, $compile,
                                          graphService, hashSync) {
        // Menu things
        $scope.enable_tab = function (tab_id) {
            $('.nav-tabs a[href="#' + tab_id + '"]').tab('show');
        };

        // Sigma things
        $scope.hover_elt = undefined;
        $scope.clicked_elt = undefined;
        $scope.cur_elt = undefined;
        $scope.counts = {
            flows: 0,
            clients: 0,
            servers: 0,
        };

        $scope.elt_details = function (elt, type, force) {
            if (elt !== undefined &&
                    (!graphService.has_details($scope.sigma, elt) || force)) {
                q = {
                    id: elt.id,
                    labels: elt.labels,
                    type: type,
                };
                url = config.cgibase + "?action=details&q=" +
                         encodeURIComponent(angular.toJson(q));
                $http.get(url).success(function (data) {
                    graphService.add_details($scope.sigma, elt, data);
                });
            }
        };

        $scope.click_elt = function (elt, type, force) {
            $scope.enable_tab("menu-tab-details");
            $scope.$apply(function (){
                $scope.clicked_elt = elt;
                $scope.cur_elt = elt;
                $scope.timeline_highlight_flow($scope.cur_elt);
                if (typeof elt !== "undefined") {
                    $scope.elt_details(elt, type, force);
                }
            });
        };

        $scope.init_flow = function() {
            config.cgibase = config.cgibase.replace(
                                /scanjson.py/, "flowjson.py")

            $scope.sigma.bind('hovers', function(e) {
                var node = e.data.enter.nodes[0];
                var edge = e.data.enter.edges[0];
                var elt = (node === undefined ? edge : node);
                $scope.$apply(function () {
                    $scope.hover_elt = elt;
                    $scope.cur_elt = elt || $scope.clicked_elt;
                    $scope.timeline_highlight_flow($scope.cur_elt);
                });

            });

            $scope.sigma.bind('doubleClickNode clickNode rightClickNode', function(e) {
                var node = e.data.node;
                $scope.click_elt(node, "node", e.type == 'doubleClickNode');
            });

            $scope.sigma.bind('doubleClickEdge clickEdge rightClickEdge', function(e) {
                var edge = e.data.edge;
                $scope.click_elt(edge, "edge", e.type == 'doubleClickEdge');
            });

            $scope.sigma.bind('clickStage doubleClickStage rightClickStage', function(e) {
                $scope.click_elt(undefined);
            });

            var tooltip_render = function(node, template) {
                var dom_elt = angular.element(template);
                var link_func = $compile(dom_elt);
                var element = link_func($scope);
                $scope.$apply();
                return element[0];
            };


            // Tooltip conf
            var tooltips_config = {
                node: [{
                    show: 'rightClickNode',
                    position: 'right',
                    template: '<graph-right-click/>',
                    autoadjust: true,
                    renderer: tooltip_render,
                }],
                edge: [{
                    show: 'rightClickEdge',
                    position: 'right',
                    template: '<graph-right-click/>',
                    autoadjust: true,
                    renderer: tooltip_render,
                }],
            };

            sigma.plugins.tooltips($scope.sigma, $scope.sigma.renderers[0],
                                   tooltips_config);
        };

        $scope.load_json = function(data) {
            $scope.sigma.graph.clear();
            $scope.sigma.graph.read(data);
            graphService.setup($scope.sigma, $scope.graph_formatters,
                               $scope.graph_filters);
            graphService.enable_halo($scope.sigma);
            $scope.update_graph_display();
            $scope.draw_timeline(data);
        };

        $scope.load_json_url = function (url) {
            $http.get(url).success($scope.load_json);
        };

        $scope.cypher_query = "";
        hashSync.sync($scope, 'cypher_query', 'cypher_query', 'ref');

        $scope.query = {
            nodes: [],
            edges: [],
            limit: 1000,
            skip: 0,
            mode: "default",
            timeline: true,
        };
        hashSync.sync($scope, 'query', 'query', 'val');

        $scope.query_ready = {};
        $scope.query_modes = [{
          label: "Default",
          id: "default",
        }, {
          label: "Flow Map",
          id: "flow_map",
        }, {
          label: "Talk Map",
          id: "talk_map",
        }];

        $scope.flow_to_date = {};
        $scope.date_to_flow = {};
        $scope.draw_timeline = function(data) {
            if(data === undefined) {
                data = $scope.timeline_data;
            }
            else {
                $scope.timeline_data = data;
            }
            d3.select("#timeline")[0][0].innerHTML = '';
            if (!data.edges || !data.edges[0] || !data.edges[0].data ||
                    !data.edges[0].data.meta ||
                    !data.edges[0].data.meta.times) {
                return;
            }
            var dr_w = 1000, dr_h = 10;
            var timerange = d3.extent(data.edges.reduce(function(dates, flow) {
                return dates.concat(flow.data.meta.times.map(function(date) {
                    date = new Date(date.replace(" ", "T"));
                    date = new Date(date - (date % config.flow_time_precision));
                    return date;
                }));
            }, [])).reduce(function(x, y) {return y - x});
            var time_prec = $scope.time_prec = (
                this.max_time_slots > 1 ?
                    Math.max(timerange / (this.max_time_slots - 1),
                             config.flow_time_precision * 1000) :
                    config.flow_time_precision * 1000
            );
            var vis = d3.select("#timeline")
                .append("svg:svg")
                .attr("viewBox", [0, 0, dr_w, dr_h])
                .attr("class", "fullfill")
                .attr("preserveAspectRatio", "none")
                .append("svg:g");

            var dates = [], counts = {};
            $scope.date_to_flow = {};
            $scope.flow_to_date = {};
            data.edges.forEach(function(flow) {
                flow.data.meta.times.forEach(function(date) {
                    date = new Date(date.replace(" ", "T"));
                    date = new Date(date - (date % time_prec));
                    if ($scope.date_to_flow[date] === undefined) {
                        dates.push(date);
                        $scope.date_to_flow[date] = {};
                    }
                    $scope.date_to_flow[date][flow.id] = true;

                    if ($scope.flow_to_date[flow.id] === undefined) {
                        $scope.flow_to_date[flow.id] = {};
                    }
                    $scope.flow_to_date[flow.id][date] = true;
                });
            });

            for (date in $scope.date_to_flow) {
                counts[date] = Object.keys($scope.date_to_flow[date]).length;
            }

            var dateextent = d3.extent(dates);
            var alldates = Array.apply(
                    0,
                    Array(Math.ceil((dateextent[1] - dateextent[0]) / time_prec)
                          + 1)
                ).map(function(_, i) {
                    return new Date(dateextent[0].getTime() + time_prec * i);
                });
            var width = Math.max((time_prec * dr_w / (
                (dateextent[1] - dateextent[0] + time_prec)
                    || time_prec)) - 1, 1);
            var x = d3.time.scale()
                .domain(dateextent)
                .range([0, dr_w - width]);
            var y = d3.scale.linear()
                .domain([0, d3.max(dates, function(x) {return counts[x];})])
                .range([0, dr_h]);

            vis.append("g")
                .selectAll("g.bar")
                .data(dates)
                .enter().append("svg:g")
                .attr("class", "bar")
                .attr("transform", function(d, i) {
                    var ytr = dr_h - y(counts[d]);
                    return "translate(" + x(d) + ", " + ytr + ")";
                })
                .append("svg:rect")
                .attr("fill", "steelblue")
                .attr("width", width)
                .attr("height", function(d, i) {return y(counts[d]);})

            vis.append("g")
                .selectAll("g.bar")
                .data(alldates)
                .enter().append("svg:g")
                .attr("class", "bar")
                .attr("transform", function(d, i) {
                    return "translate(" + x(d) + ")";
                })
                .append("svg:rect")
                .attr("fill", "white")
                .attr("fill-opacity", 0)
                .attr("width", width)
                .attr("height", dr_h)
                .attr("class", "timeline-highlight")
                .on("mouseover", function(d) {
                    var rect = d3.select(this);
                    rect.attr("old-fill-opacity", rect.attr("fill-opacity"));
                    rect.attr("fill-opacity", 0.4);
                })
                .on("mouseout", function(d) {
                    var rect = d3.select(this);
                    rect.attr("fill-opacity", rect.attr("old-fill-opacity"));
                })
                .append("svg:title")
                .text(function(d, i) {
                    var date = new Date(d - (d % time_prec))
                    var count = (counts[date] || 0);
                    return (date + ": " + count + " flow" +
                            (count > 1 ? "s" : ""));
                })

        };

        $scope.timeline_highlight_flow = function (elt) {
            var time_prec = $scope.time_prec;
            if (elt === undefined) {
                elts = [];
            }
            else if (elt.labels[0] === "Host") {
                elts = $scope.sigma.graph.adjacentEdges(elt.id);
            }
            else {
                elts = [elt];
            }
            d3.selectAll(".timeline-highlight")
                .each(function (d, i) {
                    var date = new Date(d - (d % time_prec)),
                        highlight = false;
                    for(var i = 0; i < elts.length; i++) {
                        var fl_to_date = $scope.flow_to_date[elts[i].id];
                        if(fl_to_date !== undefined && fl_to_date[date]) {
                            highlight = true;
                            break;
                        }
                    }
                    if(highlight) {
                        d3.select(this).attr("fill-opacity", 0.2);
                    } else {
                        d3.select(this).attr("fill-opacity", 0);
                    }
                });
        };

        $scope.update_graph_data = function () {
            r = $scope.query_ready;
            if (r.nodes && r.edges) {
                $scope.query.count = false;
                $scope.load_json_url(config.cgibase + "?q=" +
                             encodeURIComponent(angular.toJson($scope.query)));
                $scope.query.count = true;
                $http.get(config.cgibase + "?q=" +
                          encodeURIComponent(angular.toJson($scope.query)))
                     .success(function (data) {
                         $scope.counts = data;
                     });
                $scope.query.count = false;
            }
        };

        $scope.query_attr = function(elt, attr, val, bool) {
            var element_type = elt.source === undefined ? "nodes" : "edges";
            q = "@" + attr + " = " + val
            if (!bool) {
                q = "!" + q;
            }
            $scope.query[element_type].push(q);
            $scope.update_graph_data();
        };

        $scope.query_label = function(elt, label, bool) {
            var element_type = elt.source === undefined ? "nodes" : "edges";
            q = "#" + label;
            if (!bool) {
                q = "!" + q;
            }
            $scope.query[element_type].push(q);
            $scope.update_graph_data();
        };

        //$scope._popover_filters = [[

        // Display things
        $scope.graph_formatters = { edges: {}, nodes: {} };
        $scope.gfmt = {
            nodes: {
                size: "$in",
            },
            edges: {
                size: "scbytes",
            },
        };
        hashSync.sync($scope, 'gfmt', 'gfmt', 'val');

        $scope.gfmt_parse_all = function () {
            ["nodes", "edges"].forEach(function(type) {
                for (attr in $scope.gfmt[type]) {
                    $scope.gfmt_parse(type, attr);
                }
            });
        }

        $scope.gfmt_parse = function (type, attr) {
            var str = $scope.gfmt[type][attr];
            var raw_filters = str.split(" ");
            var default_crit = undefined;
            var filters = raw_filters.reduce(function (acc, fstr) {
                parts = fstr.split(":");
                if (parts.length == 1) {
                    label = undefined;
                    crit = parts[0];
                } else if (parts.length == 2) {
                    label = parts[0];
                    crit = parts[1];
                } else {
                    add_message("param-parsing", "warning",
                            "Incorrect display filter: " + fstr);
                }

                // Either create a special formatter or an attribute getter
                crit_fmt = {
                    "$in": function (s, n) {
                        return s.graph.degree(n.id, "in");
                    },
                    "$out": function (s, n) {
                        return s.graph.degree(n.id, "out");
                    },
                }[crit] || function (s, elt) {
                    return elt.data[crit];
                };

                if (label !== undefined) {
                    acc[label] = crit_fmt;
                } else {
                    default_crit = crit_fmt;
                }

                return acc;
            }, {});

            // Build fmt function
            var fmt = function (s, elt) {
                label = elt.labels && elt.labels[0];
                if (label in filters) {
                    return filters[label](s, elt);
                } else {
                    return default_crit && default_crit(s, elt);
                }
            };

            $scope.graph_formatters[type][attr] = fmt;
        };

        // Filtering
        $scope.graph_filters = {};
        $scope.gflt = { edges: [], nodes: [] };

        $scope.gflt_parse_all = function() {
            ["edges", "nodes"].forEach(function(type) {
                var funcs = $scope.gflt[type].map(gfilter2func);
                // Final filter is true if any filter is true
                $scope.graph_filters[type] = function(elt) {
                    if (funcs.length == 0) {
                        return true;
                    }
                    for (i in funcs) {
                        if (!funcs[i](elt)) {
                            return false;
                        }
                    }
                    return true;
                }
            });
        }

        $scope.edge_size_scaling = 0;
        $scope.node_size_scaling = 2;
        $scope.max_time_slots = 100;
        hashSync.sync($scope, 'node_size_scaling', 'node_size_scaling');
        hashSync.sync($scope, 'edge_size_scaling', 'edge_size_scaling');
        $scope.update_graph_display = function () {
            $scope.edge_size_scaling = Math.max($scope.edge_size_scaling, 0)
            $scope.node_size_scaling = Math.max($scope.node_size_scaling, 0)
            $scope.sigma.settings("maxEdgeSize",
                $scope.edge_size_scaling + $scope.sigma.settings("minEdgeSize"));
            $scope.sigma.settings("maxNodeSize",
                $scope.node_size_scaling + $scope.sigma.settings("minNodeSize"));
            $scope.gfmt_parse_all();
            $scope.gflt_parse_all();
            graphService.update_display($scope.sigma, $scope.graph_formatters,
                                $scope.graph_filters);
        };

        $scope.is_array = angular.isArray;
});
