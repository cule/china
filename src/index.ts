import * as dc from "dc";
import * as d3 from "d3";
import * as moment from "moment"
import crossfilter from "crossfilter2";

import { customSearch } from "./custom-search"

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "dc/dist/style/dc.min.css"


const genderChart = dc.pieChart("#gender-chart");
const lifeConditionChart = dc.pieChart("#life-condition-chart");
const statusChart = dc.rowChart("#status-chart")
const dateOfBirthChart = dc.barChart("#date-of-birth-chart");
const searchNameWidget = customSearch("#search-name");
const prisonerTable = dc.dataTable("#prisoner-table");

interface Prisoner {
  "Name": string;
  "Gender": "male" | "female" | "";
  "Place": string;
  "Date of Death": string;
  "Date of Birth": string;
  "Sentence": string;
  "Source": string;
}


d3.csv("chinese-political-prisoners.csv").then((data: any) => {
  const prisoners = crossfilter(data as Array<Prisoner>);
  const all = prisoners.groupAll();


  const nameDimension = prisoners.dimension(d => d.Name);
  const genderDimension = prisoners.dimension(d => d.Gender);
  const genderGroup = genderDimension.group();
  const birthYearDimension = prisoners.dimension(d => {
    if (d["Date of Birth"]) {
      return parseInt(d["Date of Birth"].substring(0, 4));
    } else {
      return 0;
    }
  });
  const birthYearGroup = birthYearDimension.group();
  const conditionDimension = prisoners.dimension(d => {
    if (d["Date of Death"]) {
      return true;
    } else {
      return false;
    }
  });
  const conditionGroup = conditionDimension.group();


  const inPrisonDimension = prisoners.dimension(d => {
    if (d["Date of Death"]) {
      return "出狱";
    }
    let sentence = d["Sentence"];
    if (sentence === "unknown" || sentence === "") { // we assume "unknown" string in the csv to be in the prison
      return "未知";
    } else if (sentence === "life") {
      return "监狱";
    } else if (sentence === "detention") {
      return "看守所";
    } else {
      let d = moment(sentence);
      if (sentence.length === 4) { // YYYY -> YYYY-12-31
        d = moment(sentence).endOf("year");
      } else if (sentence.length === 7) { // YYYY-MM -> YYYY-MM-ENDofMONTH
        d = moment(sentence).endOf("month");
      } else if (sentence.length === 10) {
        d = moment(sentence);
      }
      if (moment() < d) {
        return "监狱";
      } else {
        return "出狱";
      }
    }
  })
  const inPrisonGroup = inPrisonDimension.group();


  genderChart
  .width(200)
  .height(200)
  .radius(85)
  .minAngleForLabel(0)
  .dimension(genderDimension)
  .group(genderGroup)
  .label(d => {
    let label;
    if(d.key === "male") {
      label = "男";
    } else if (d.key === "female") {
      label = "女";
    } else {
      label = "未知";
    }
    if (all.value()) {
      // label += ` - ${d.value} - ${(d.value / (all.value() as number) * 100).toFixed(1)}%`;
      label += ` - ${d.value}`;
    }
    return label;
  })
  .renderLabel(true)
  .transitionDuration(500);


  lifeConditionChart
  .width(200)
  .height(200)
  .radius(85)
  .minAngleForLabel(0)
  .dimension(conditionDimension)
  .group(conditionGroup)
  .label(d => {
    let label;
    if (d.key === true) {
      label = "死亡";
    } else {
      label = "活着";
    };
    label += ` - ${d.value}`;
    return label;
  })
  .renderLabel(true)
  .transitionDuration(500);

  statusChart
  .width(220)
  .height(200)
  .dimension(inPrisonDimension)
  .group(inPrisonGroup)
  .label(d => {
    let label;
    label = `${d.key} - ${d.value}`;
    return label;
  })
  .transitionDuration(500)
  .elasticX(true)
  .xAxis().ticks(3);
  // .legend(dc.legend().legendText((d:any) => d.name + ': ' + d.data));

  // https://dc-js.github.io/dc.js/vc/index.html
  // https://dc-js.github.io/dc.js/crime/index.html
  const birthYearGroupAll = birthYearGroup.all();
  const minBirthYear= birthYearGroupAll[1].key as number;
  const maxBirthYear = birthYearGroupAll[birthYearGroupAll.length - 1].key as number;
  dateOfBirthChart
  .width(420)
  .height(200)
  .dimension(birthYearDimension)
  .group(birthYearGroup)
  .x(d3.scaleLinear().domain([minBirthYear, maxBirthYear]));

  searchNameWidget
  .dimension(nameDimension)
  .placeHolder("搜索姓名" as any);

  prisonerTable
  .dimension(birthYearDimension)
  .showSections(false)
  .size(Infinity)
  .order(d3.descending)
  .columns([
    {
      label: "姓名",
      format: (d:Prisoner) => d.Name
    }, {
      label: "性别",
      format: (d:Prisoner) => {
        if (d["Gender"] === "female") {
          return "女";
        } else if (d["Gender"] === "male"){
          return "男";
        } else {
          return "未知"
        }
      }
    }, {
      label: "出生日期",
      format: (d:Prisoner) => {
        if (d["Date of Birth"]) {
          return d["Date of Birth"];
        } else {
          return "未知";
        }
      }
    }, {
      label: "死亡日期",
      format: (d:Prisoner) => d["Date of Death"]
    }, {
      label: "刑",
      format: (d:Prisoner) => {
        const sentence = d.Sentence;
        if (sentence === "detention") {
          return "看守所";
        } else if (sentence === "unknown") {
          return "未知";
        } else {
          return d["Sentence"];
        }
      }
    }, {
      label: "出生地",
      format: (d:Prisoner) => d.Place
    }, {
      label: "来源",
      format: (d:Prisoner) => {
        let sources = d.Source.split(" ");
        let output = "";
        sources.forEach((s, i)=> {
          output += `<a target="_blank" href=${s}>s${i+1}</a> `
        });
        return output
      }
    }
  ])
  .on('preRender', update_offset)
  .on('preRedraw', update_offset)
  .on('pretransition', display);


  // use odd page size to show the effect better
  var ofs = 0, pag = 15;

  function update_offset() {
      var totFilteredRecs = prisoners.groupAll().value();
      var end = ofs + pag > totFilteredRecs ? totFilteredRecs : ofs + pag;
      ofs = ofs >= totFilteredRecs ? Math.floor((totFilteredRecs as number - 1) / pag) * pag : ofs;
      ofs = ofs < 0 ? 0 : ofs;

      prisonerTable.beginSlice(ofs);
      prisonerTable.endSlice(ofs+pag);
  }
  function display() {
      var totFilteredRecs = prisoners.groupAll().value();
      var end = ofs + pag > totFilteredRecs ? totFilteredRecs : ofs + pag;
      d3.select('#begin')
          .text(end === 0? ofs : ofs + 1);
      d3.select('#end')
          .text(end as any);
      d3.select('#last')
          .attr('disabled', ofs-pag<0 ? 'true' : null);
      d3.select('#next')
          .attr('disabled', ofs+pag>=totFilteredRecs ? 'true' : null);
      d3.select('#size').text(totFilteredRecs as any);
      if(totFilteredRecs != prisoners.size()){
        d3.select('#totalsize').text("(filtered Total: " + prisoners.size() + " )");
      }else{
        d3.select('#totalsize').text('');
      }
  }
  document.getElementById("last").onclick = () => {
    ofs -= pag;
    update_offset();
    prisonerTable.redraw();
  }
  document.getElementById("next").onclick = () => {
    ofs += pag;
    update_offset();
    prisonerTable.redraw();
  }
  
  dc.renderAll();
  console.log("Render finished");
});
